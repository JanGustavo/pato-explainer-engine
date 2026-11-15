import asyncio
import json
import math
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


async def render_video_stream(episode_dir: Path, engine_dir: Path) -> None:
    timeline_path = episode_dir / "output" / "timeline.json"
    if not timeline_path.exists():
        raise FileNotFoundError(f"Execute 1_generate_audio.py primeiro. Faltando: {timeline_path}")

    timeline = json.loads(timeline_path.read_text(encoding="utf-8"))
    total_duration = float(timeline["total_duration"])
    total_frames = math.ceil(total_duration * FPS)
    raw_video_path = episode_dir / "output" / "video_raw.mp4"

    # Inicia o Vite headless
    vite_proc = subprocess.Popen(
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"],
        cwd=str(engine_dir),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        wait_for_server(VITE_URL)

        # Abre pipe FFmpeg para encodar frames JPEG enviados via stdin em H.264 60fps
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-f", "image2pipe",
            "-vcodec", "mjpeg",
            "-r", str(FPS),
            "-i", "-",
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "18",
            "-threads", "8",
            "-pix_fmt", "yuv420p",
            str(raw_video_path),
        ]
        ffmpeg_proc = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
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
            page = await browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
            await page.goto(VITE_URL, wait_until="networkidle")
            await page.wait_for_function("window.__ENGINE_READY__ === true")

            await page.evaluate(
                """(timelineData) => {
                    window.enableHeadlessMode();
                    window.loadTimeline(timelineData);
                }""",
                timeline,
            )

            print(f"[INFO] Renderizando {total_frames} frames ({total_duration:.2f}s @ {FPS}fps)...")
            t0 = time.time()

            for frame_idx in range(total_frames):
                t_sec = frame_idx / FPS
                await page.evaluate("(t) => window.renderAtTime(t)", t_sec)
                img_bytes = await asyncio.wait_for(
                    page.screenshot(type="jpeg", quality=92),
                    timeout=SCREENSHOT_TIMEOUT_SEC,
                )
                ffmpeg_proc.stdin.write(img_bytes)

                if frame_idx > 0 and frame_idx % (FPS * 5) == 0:
                    elapsed = time.time() - t0
                    pct = (frame_idx / total_frames) * 100
                    print(f"  Progresso: {pct:.1f}% ({frame_idx}/{total_frames} frames em {elapsed:.1f}s)")

            ffmpeg_proc.stdin.close()
            ffmpeg_proc.stdin = None
            _, stderr = ffmpeg_proc.communicate()
            if ffmpeg_proc.returncode != 0:
                raise RuntimeError(f"Erro no FFmpeg: {stderr.decode('utf-8', errors='ignore')}")

            await browser.close()

        print(f"[OK] Vídeo bruto renderizado -> {raw_video_path}")

    finally:
        vite_proc.terminate()
        vite_proc.wait(timeout=5)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python 2_render_frames.py ../episodes/ep01_ventilador")
        sys.exit(1)
    ep_dir = Path(sys.argv[1]).resolve()
    eng_dir = Path(__file__).resolve().parent.parent / "engine"
    asyncio.run(render_video_stream(ep_dir, eng_dir))