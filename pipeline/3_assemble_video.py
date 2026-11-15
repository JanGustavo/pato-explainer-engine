import subprocess
import sys
from pathlib import Path


def assemble_final_video(episode_dir: Path, assets_dir: Path) -> None:
    out_dir = episode_dir / "output"
    raw_video = out_dir / "video_raw.mp4"
    narration = out_dir / "narration.wav"
    final_mp4 = out_dir / f"{episode_dir.name}_final.mp4"

    if not raw_video.exists() or not narration.exists():
        raise FileNotFoundError("Certifique-se de que video_raw.mp4 e narration.wav existem em output/.")

    bgm_files = sorted((assets_dir / "bgm").glob("*.mp3"))

    if bgm_files:
        bgm = bgm_files[0]
        cmd = [
            "ffmpeg", "-y",
            "-i", str(raw_video),
            "-i", str(narration),
            "-stream_loop", "-1", "-i", str(bgm),
            "-filter_complex",
            "[1:a]volume=1.15[voice];[2:a]volume=0.12[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]",
            "-map", "0:v:0",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            str(final_mp4),
        ]
    else:
        cmd = [
            "ffmpeg", "-y",
            "-i", str(raw_video),
            "-i", str(narration),
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            str(final_mp4),
        ]

    subprocess.run(cmd, check=True)
    print(f"[OK] Episódio final pronto para publicação -> {final_mp4}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python 3_assemble_video.py ../episodes/ep01_ventilador")
        sys.exit(1)
    ep_dir = Path(sys.argv[1]).resolve()
    assets_root = Path(__file__).resolve().parent.parent / "assets"
    assemble_final_video(ep_dir, assets_root)