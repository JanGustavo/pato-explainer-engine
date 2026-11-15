import asyncio
import argparse
import json
import math
import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from playwright.async_api import async_playwright

FPS = 30
WIDTH = 1080
HEIGHT = 1920
VITE_URL = "http://127.0.0.1:5173"
SCREENSHOT_TIMEOUT_SEC = 30


def wait_for_server(url: str, timeout: float = 15.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as resp:
                if resp.status == 200:
                    return
        except Exception:
            time.sleep(0.25)
    raise RuntimeError(f"Servidor Vite não respondeu em {url}")


async def render_video_stream(episode_dir: Path, engine_dir: Path, *, preview: bool = False,
                              scene_number: int | None = None, start: float | None = None,
                              end: float | None = None, stills: bool = False) -> None:
    timeline_path = episode_dir / "output" / "timeline.json"
    if not timeline_path.exists():
        raise FileNotFoundError(f"Execute 1_generate_audio.py primeiro. Faltando: {timeline_path}")

    timeline = json.loads(timeline_path.read_text(encoding="utf-8"))
    total_duration = float(timeline["total_duration"])
    scenes = timeline.get("scenes", [])
    if scene_number is not None:
        if scene_number < 1 or scene_number > len(scenes):
            raise ValueError(f"Cena {scene_number} inválida; use 1 a {len(scenes)}")
        selected = scenes[scene_number - 1]
        start = float(selected["start"])
        end = float(selected["end"])
    start = 0.0 if start is None else start
    end = total_duration if end is None else end
    if not (0 <= start < end <= total_duration + 0.001):
        raise ValueError(f"Trecho inválido: {start:.2f}–{end:.2f}s; duração {total_duration:.2f}s")
    fps = 15 if preview else FPS
    width, height = (540, 960) if preview else (WIDTH, HEIGHT)
    total_frames = math.ceil((end - start) * fps)
    suffix = "_preview" if preview else ""
    suffix += f"_scene_{scene_number:02d}" if scene_number is not None else (f"_{start:g}-{end:g}s" if start or end < total_duration else "")
    raw_video_path = episode_dir / "output" / f"video_raw{suffix}.mp4"

    # Inicia o Vite headless em seu próprio process group
    vite_proc = subprocess.Popen(
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
        cwd=str(engine_dir),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )

    try:
        wait_for_server(VITE_URL)

        # Prévia e quadros evitam codificar o vídeo inteiro durante ajustes.
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-f", "image2pipe",
            "-vcodec", "mjpeg",
            "-r", str(fps),
            "-i", "-",
            "-c:v", "libx264",
            "-preset", "veryfast" if preview else "medium",
            "-crf", "28" if preview else "18",
            "-threads", "0",
            "-pix_fmt", "yuv420p",
            str(raw_video_path),
        ]
        ffmpeg_proc = None if stills else subprocess.Popen(
            ffmpeg_cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        )

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--use-gl=angle",
                    "--use-angle=swiftshader",
                    "--enable-webgl",
                    "--ignore-gpu-blocklist",
                ],
            )
            page = await browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
            page.on("pageerror", lambda err: print(f"[BROWSER ERROR] {err}", file=sys.stderr))
            page.on("console", lambda msg: print(f"[BROWSER CONSOLE {msg.type}] {msg.text}", file=sys.stderr) if msg.type == "error" else None)
            await page.goto(VITE_URL + ("?renderScale=0.5" if preview else ""), wait_until="networkidle")
            await page.wait_for_function("window.__ENGINE_READY__ === true")

            await page.evaluate(
                """(timelineData) => {
                    window.enableHeadlessMode();
                    window.loadTimeline(timelineData);
                }""",
                timeline,
            )

            print(f"[INFO] Renderizando {total_frames} quadros ({start:.2f}–{end:.2f}s @ {fps}fps, {width}×{height})...")
            t0 = time.time()

            frame_indices = range(total_frames) if not stills else sorted({0, total_frames // 2, total_frames - 1})
            still_dir = episode_dir / "output" / "stills"
            if stills:
                still_dir.mkdir(parents=True, exist_ok=True)
            for frame_idx in frame_indices:
                t_sec = start + frame_idx / fps
                await page.evaluate("(t) => window.renderAtTime(t)", t_sec)
                img_bytes = await asyncio.wait_for(
                    page.screenshot(type="jpeg", quality=92),
                    timeout=SCREENSHOT_TIMEOUT_SEC,
                )
                if stills:
                    (still_dir / f"frame_{t_sec:07.2f}s.jpg").write_bytes(img_bytes)
                else:
                    ffmpeg_proc.stdin.write(img_bytes)

                if not stills and frame_idx > 0 and frame_idx % (fps * 5) == 0:
                    elapsed = time.time() - t0
                    pct = (frame_idx / total_frames) * 100
                    print(f"  Progresso: {pct:.1f}% ({frame_idx}/{total_frames} frames em {elapsed:.1f}s)")

            if ffmpeg_proc is not None:
                ffmpeg_proc.stdin.close()
                ffmpeg_proc.stdin = None
                _, stderr = ffmpeg_proc.communicate()
                if ffmpeg_proc.returncode != 0:
                    raise RuntimeError(f"Erro no FFmpeg: {stderr.decode('utf-8', errors='ignore')}")

            await browser.close()

        print(f"[OK] {'Quadros salvos' if stills else 'Vídeo bruto renderizado'} -> {still_dir if stills else raw_video_path}")

    finally:
        try:
            os.killpg(os.getpgid(vite_proc.pid), signal.SIGTERM)
        except Exception:
            try:
                vite_proc.terminate()
            except Exception:
                pass
        try:
            vite_proc.wait(timeout=5)
        except Exception:
            pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Renderiza vídeo bruto, prévia ou quadros de um episódio")
    parser.add_argument("episode", type=Path)
    parser.add_argument("--preview", action="store_true", help="540×960 a 15 fps")
    parser.add_argument("--scene", type=int, help="número da cena (começa em 1)")
    parser.add_argument("--from", dest="start", type=float, help="início em segundos")
    parser.add_argument("--to", dest="end", type=float, help="fim em segundos")
    parser.add_argument("--stills", action="store_true", help="salva começo, meio e fim sem codificar vídeo")
    options = parser.parse_args()
    ep_dir = options.episode.resolve()
    eng_dir = Path(__file__).resolve().parent.parent / "engine"
    asyncio.run(render_video_stream(ep_dir, eng_dir, preview=options.preview,
                                    scene_number=options.scene, start=options.start,
                                    end=options.end, stills=options.stills))
