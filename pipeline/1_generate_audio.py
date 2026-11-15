import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from kokoro_onnx.config import EspeakConfig

VOICE = "pm_alex"
LANG = "pt-br"
SPEED = 1.12
SCENE_PAUSE_SEC = 0.22
SAMPLE_RATE = 24000


def create_kokoro(model_path: Path, voices_path: Path) -> Kokoro:
    system_espeak_lib = Path("/usr/lib/x86_64-linux-gnu/libespeak-ng.so.1")
    system_espeak_data = Path("/usr/lib/x86_64-linux-gnu/espeak-ng-data")
    if system_espeak_lib.exists() and system_espeak_data.is_dir():
        espeak_config = EspeakConfig(
            lib_path=str(system_espeak_lib),
            data_path=str(system_espeak_data),
        )
        return Kokoro(str(model_path), str(voices_path), espeak_config=espeak_config)
    return Kokoro(str(model_path), str(voices_path))


def build_episode_audio(episode_dir: Path, assets_dir: Path) -> None:
    script_path = episode_dir / "script.json"
    if not script_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {script_path}")

    model_path = assets_dir / "tts" / "kokoro-v1.0.onnx"
    voices_path = assets_dir / "tts" / "voices-v1.0.bin"
    if not model_path.exists() or not voices_path.exists():
        raise FileNotFoundError(
            f"Modelos do Kokoro não encontrados em {assets_dir / 'tts'}. "
            "Baixe kokoro-v1.0.onnx e voices-v1.0.bin primeiro."
        )

    kokoro = create_kokoro(model_path, voices_path)
    script = json.loads(script_path.read_text(encoding="utf-8"))
    out_dir = episode_dir / "output"
    clips_dir = out_dir / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)

    timeline_scenes = []
    full_audio_chunks = []
    cursor = 0.0

    for idx, scene in enumerate(script.get("scenes", [])):
        narration = (scene.get("narration") or "").strip()
        if narration:
            samples, sample_rate = kokoro.create(
                narration,
                voice=VOICE,
                speed=SPEED,
                lang=LANG,
            )
            samples = np.asarray(samples, dtype=np.float32)
        else:
            sample_rate = SAMPLE_RATE
            samples = np.zeros(int(1.5 * sample_rate), dtype=np.float32)

        speech_dur = len(samples) / float(sample_rate)
        pause_samples = np.zeros(
            int(SCENE_PAUSE_SEC * sample_rate),
            dtype=np.float32,
        )
        scene_audio = np.concatenate([samples, pause_samples])
        full_audio_chunks.append(scene_audio)
        sf.write(
            str(clips_dir / f"scene_{idx:02d}.wav"),
            scene_audio,
            sample_rate,
        )

        total_scene_dur = len(scene_audio) / float(sample_rate)
        enriched_scene = dict(scene)
        enriched_scene["start"] = round(cursor, 3)
        enriched_scene["speech_end"] = round(cursor + speech_dur, 3)
        enriched_scene["end"] = round(cursor + total_scene_dur, 3)
        timeline_scenes.append(enriched_scene)
        cursor += total_scene_dur

    raw_concat = out_dir / "narration_24k.wav"
    final_narration = out_dir / "narration.wav"
    sf.write(str(raw_concat), np.concatenate(full_audio_chunks), SAMPLE_RATE)
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(raw_concat),
            "-ar", "44100", "-ac", "1",
            str(final_narration),
        ],
        capture_output=True,
        check=True,
    )
    raw_concat.unlink(missing_ok=True)

    timeline = {
        "episode_id": script.get("episode_id", episode_dir.name),
        "title": script.get("title", ""),
        "outfit": script.get("outfit", "workshop"),
        "bgm_mood": script.get("bgm_mood", "curious_upbeat"),
        "total_duration": round(cursor, 3),
        "scenes": timeline_scenes,
    }
    timeline_path = out_dir / "timeline.json"
    timeline_path.write_text(
        json.dumps(timeline, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(
        f"[OK] Kokoro TTS gerado ({timeline['total_duration']}s, "
        f"voz={VOICE}) -> {timeline_path}"
    )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python 1_generate_audio.py ../episodes/ep01_protetor_solar")
        sys.exit(1)
    episode_dir = Path(sys.argv[1]).resolve()
    assets_root = Path(__file__).resolve().parent.parent / "assets"
    build_episode_audio(episode_dir, assets_root)
