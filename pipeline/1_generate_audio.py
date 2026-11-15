import json
import hashlib
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from kokoro_onnx.config import EspeakConfig

LANG = "pt-br"
SAMPLE_RATE = 24000

VOICE_A = "pm_alex"
VOICE_B = "pm_santa"
BLEND_WEIGHTS = (0.75, 0.25)

SPEED_BY_KIND = {
    "hook": 1.22,
    "curious": 1.04,
    "explain": 1.05,
    "payoff": 1.15,
    "outro": 1.08,
}
PAUSE_BY_KIND = {
    "hook": 0.12,
    "curious": 0.28,
    "explain": 0.22,
    "payoff": 0.20,
    "outro": 0.35,
}
LONG_TEXT_WORDS = 32

MAX_WORDS_PER_CHUNK = 3
STRONG_END = (".", "!", "?", "…")
SOFT_END = (",", ";", ":", "—", "–")

BEAT_MARK = "||"
BEAT_PAUSE_SEC = 0.32

TTS_REPLACEMENTS = [
    (r"\bEl Niño\b", "El Ninho"),
    (r"\bNiño\b", "Ninho"),
    (r"(\d+)\s*°\s*C\b", r"\1 graus Celsius"),
    (r"(\d+)\s*°", r"\1 graus"),
    (r"\bQuackLab\b", "Quéc Lab"),
    (r"%", " por cento"),
]


def normalize_for_tts(text: str) -> str:
    for pattern, repl in TTS_REPLACEMENTS:
        text = re.sub(pattern, repl, text)
    return text


def synth_segments(kokoro, voice, narration: str, speed: float):
    """Sintetiza trechos separados por '||'. Retorna (áudio, [(texto_original, offset_s, dur_s)])."""
    parts = [p.strip() for p in narration.split(BEAT_MARK) if p.strip()]
    audio, spans, offset = [], [], 0.0
    for i, part in enumerate(parts):
        samples, sr = kokoro.create(normalize_for_tts(part), voice=voice, speed=speed, lang=LANG)
        samples = np.asarray(samples, dtype=np.float32)
        samples = trim_and_fade(to_rate(samples, sr, SAMPLE_RATE), SAMPLE_RATE)
        dur = len(samples) / float(SAMPLE_RATE)
        spans.append((part, offset, dur))
        audio.append(samples)
        offset += dur
        if i < len(parts) - 1:
            audio.append(np.zeros(int(BEAT_PAUSE_SEC * SAMPLE_RATE), dtype=np.float32))
            offset += BEAT_PAUSE_SEC
    return np.concatenate(audio), spans


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


def build_voice(kokoro: Kokoro):
    """Mistura duas vozes (np.ndarray). Fallback: voz única."""
    try:
        a = kokoro.get_voice_style(VOICE_A)
        b = kokoro.get_voice_style(VOICE_B)
        blended = np.add(a * BLEND_WEIGHTS[0], b * BLEND_WEIGHTS[1])
        return blended, f"{VOICE_A}*{BLEND_WEIGHTS[0]}+{VOICE_B}*{BLEND_WEIGHTS[1]}"
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] Blend de vozes indisponível ({exc}); usando {VOICE_A}.")
        return VOICE_A, VOICE_A


def classify_scene(idx: int, total: int, scene: dict) -> str:
    explicit = scene.get("tone")
    if explicit in SPEED_BY_KIND:
        return explicit
    anim = (scene.get("duck") or {}).get("anim", "idle")
    if idx == 0 or anim == "shock":
        return "hook"
    if anim == "celebrate":
        return "payoff"
    if anim == "confused":
        return "curious"
    if idx == total - 1:
        return "outro"
    return "explain"


def to_rate(samples: np.ndarray, sr: int, target: int) -> np.ndarray:
    if sr == target or len(samples) == 0:
        return samples
    n = int(len(samples) * target / sr)
    xs = np.linspace(0, len(samples) - 1, n)
    return np.interp(xs, np.arange(len(samples)), samples).astype(np.float32)


def trim_and_fade(samples: np.ndarray, sr: int, thr: float = 0.008, pad: float = 0.04) -> np.ndarray:
    """Remove silêncio nas pontas (mantém 40ms) e aplica fade curto para evitar cliques."""
    idx = np.flatnonzero(np.abs(samples) > thr)
    if idx.size == 0:
        return samples
    start = max(0, int(idx[0]) - int(pad * sr))
    end = min(len(samples), int(idx[-1]) + int(pad * sr))
    out = samples[start:end].copy()
    fade = min(int(0.008 * sr), len(out) // 2)
    if fade > 0:
        ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)
        out[:fade] *= ramp
        out[-fade:] *= ramp[::-1]
    return out


def _core_len(word: str) -> int:
    return len(re.sub(r"[^\w]", "", word, flags=re.UNICODE))


def _word_units(word: str, is_last: bool) -> tuple[float, float]:
    body = max(1, _core_len(word)) + 1.5
    pause = 0.0
    if not is_last:
        if word.endswith(STRONG_END):
            pause = 5.0
        elif word.endswith(SOFT_END):
            pause = 3.0
    return body, pause


def _group_words(words: list[str]) -> list[list[int]]:
    groups: list[list[int]] = []
    cur: list[int] = []
    for i, w in enumerate(words):
        cur.append(i)
        strong = w.endswith(STRONG_END)
        soft = w.endswith(SOFT_END)
        if (
            len(cur) >= MAX_WORDS_PER_CHUNK
            or strong
            or (soft and len(cur) >= 2)
            or (len(cur) >= 2 and _core_len(w) >= 9)
        ):
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)

    merged: list[list[int]] = []
    for g in groups:
        if (
            len(g) == 1
            and merged
            and len(merged[-1]) < 4
            and not words[merged[-1][-1]].endswith(STRONG_END)
        ):
            merged[-1].extend(g)
        else:
            merged.append(g)
    return merged


def build_caption_chunks(narration: str, start: float, speech_dur: float) -> list[dict]:
    words = re.findall(r"\S+", narration)
    if not words or speech_dur <= 0:
        return []

    units = [_word_units(w, i == len(words) - 1) for i, w in enumerate(words)]
    total = sum(b + p for b, p in units)
    unit = speech_dur / total

    cursor = start
    timed = []
    for w, (body, pause) in zip(words, units):
        ws = cursor
        we = cursor + body * unit
        timed.append({"w": w, "start": round(ws, 3), "end": round(we, 3)})
        cursor = we + pause * unit

    groups = _group_words(words)
    speech_end = round(start + speech_dur, 3)
    chunks = []
    for ci, g in enumerate(groups):
        ws = [timed[i] for i in g]
        end = timed[groups[ci + 1][0]]["start"] if ci + 1 < len(groups) else speech_end
        chunks.append(
            {
                "text": " ".join(x["w"] for x in ws),
                "start": ws[0]["start"],
                "end": end,
                "words": ws,
            }
        )
    return chunks


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
    voice, voice_label = build_voice(kokoro)

    script = json.loads(script_path.read_text(encoding="utf-8"))
    scenes = script.get("scenes", [])
    out_dir = episode_dir / "output"
    clips_dir = out_dir / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)
    source_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    model_signature = [(p.stat().st_size, p.stat().st_mtime_ns) for p in (model_path, voices_path)]

    timeline_scenes = []
    full_audio_chunks = []
    cursor = 0.0

    for idx, scene in enumerate(scenes):
        narration = (scene.get("narration") or "").strip()
        kind = classify_scene(idx, len(scenes), scene)
        clean = " ".join(p.strip() for p in narration.split(BEAT_MARK) if p.strip())
        n_words = len(re.findall(r"\S+", clean))

        speed = float(scene.get("tts_speed", SPEED_BY_KIND[kind]))
        if "tts_speed" not in scene and n_words > LONG_TEXT_WORDS:
            speed -= 0.03
        pause_sec = float(scene.get("pause", PAUSE_BY_KIND[kind]))

        clip_path = clips_dir / f"scene_{idx:02d}.wav"
        cache_path = clips_dir / f"scene_{idx:02d}.cache.json"
        cache_input = [source_hash, model_signature, voice_label, narration, speed,
                       pause_sec, scene.get("silent_duration", 1.5), SAMPLE_RATE]
        cache_key = hashlib.sha256(json.dumps(cache_input, ensure_ascii=False).encode()).hexdigest()
        cached = None
        if clip_path.exists() and cache_path.exists():
            try:
                candidate = json.loads(cache_path.read_text(encoding="utf-8"))
                if candidate.get("key") == cache_key:
                    cached = candidate
            except (ValueError, OSError):
                pass
        if cached:
            scene_audio, sample_rate = sf.read(str(clip_path), dtype="float32")
            if sample_rate != SAMPLE_RATE or scene_audio.ndim != 1:
                cached = None
            else:
                spans = cached["spans"]
                speech_dur = cached["speech_dur"]
                print(f"[CACHE] Cena {idx + 1}: áudio reutilizado")
        if not cached:
            spans = []
            if narration:
                samples, spans = synth_segments(kokoro, voice, narration, speed)
            else:
                samples = np.zeros(
                    int(float(scene.get("silent_duration", 1.5)) * SAMPLE_RATE), dtype=np.float32
                )
            speech_dur = len(samples) / float(SAMPLE_RATE)
            pause_samples = np.zeros(int(pause_sec * SAMPLE_RATE), dtype=np.float32)
            scene_audio = np.concatenate([samples, pause_samples])
            sf.write(str(clip_path), scene_audio, SAMPLE_RATE)
            cache_path.write_text(json.dumps({"key": cache_key, "spans": spans,
                                              "speech_dur": speech_dur}, ensure_ascii=False),
                                  encoding="utf-8")
        full_audio_chunks.append(scene_audio)

        total_scene_dur = len(scene_audio) / float(SAMPLE_RATE)
        enriched_scene = dict(scene)
        enriched_scene["narration"] = clean
        enriched_scene["start"] = round(cursor, 3)
        enriched_scene["speech_end"] = round(cursor + speech_dur, 3)
        enriched_scene["end"] = round(cursor + total_scene_dur, 3)
        enriched_scene["tts"] = {"kind": kind, "speed": round(speed, 3)}
        enriched_scene["caption_chunks"] = [
            c
            for part, off, dur in spans
            for c in build_caption_chunks(part, cursor + off, dur)
        ]
        timeline_scenes.append(enriched_scene)
        cursor += total_scene_dur

    raw_concat = out_dir / "narration_24k.wav"
    final_narration = out_dir / "narration.wav"
    sf.write(str(raw_concat), np.concatenate(full_audio_chunks), SAMPLE_RATE)
    try:
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", str(raw_concat),
                "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                "-ar", "44100", "-ac", "1",
                str(final_narration),
            ],
            capture_output=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        sys.stderr.write(exc.stderr.decode("utf-8", errors="ignore"))
        raise
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
        f"voz={voice_label}) -> {timeline_path}"
    )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python 1_generate_audio.py ../episodes/ep01_protetor_solar")
        sys.exit(1)
    episode_dir = Path(sys.argv[1]).resolve()
    assets_root = Path(__file__).resolve().parent.parent / "assets"
    build_episode_audio(episode_dir, assets_root)
