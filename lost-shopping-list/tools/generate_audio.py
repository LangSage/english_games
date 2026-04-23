from __future__ import annotations

import argparse
import asyncio
import json
import re
import shutil
import subprocess
from pathlib import Path

try:
    import edge_tts
except ImportError:  # pragma: no cover - optional dependency
    edge_tts = None

try:
    from gtts import gTTS
except ImportError:  # pragma: no cover - optional dependency
    gTTS = None


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STORY_PATH = ROOT / "assets" / "data" / "story.json"
DEFAULT_AUDIO_DIR = ROOT / "assets" / "audio" / "dialogue"
AUDIO_DIR = DEFAULT_AUDIO_DIR
FFMPEG_PATH = shutil.which("ffmpeg")
DEFAULT_EDGE_VOICE = "en-US-EmmaMultilingualNeural"
DEFAULT_EDGE_RATE = "-24%"
DEFAULT_EDGE_VOLUME = "+0%"
DEFAULT_EDGE_PITCH = "+0Hz"
DEFAULT_SYSTEM_RATE = -3
LEADING_SILENCE_MS = 220


def collect_lines(story: dict) -> list[dict]:
    seen = {}

    for line in story.get("meta", {}).get("audioPreviewLines", []):
        seen[line["id"]] = line

    for line in story.get("introLines", []):
        seen[line["id"]] = line

    for step in story.get("steps", []):
        for hint in step.get("hints", []):
            seen[hint["id"]] = hint
        for line in step.get("wrongInteraction", {}).get("lines", []):
            seen[line["id"]] = line

    for check in story.get("comprehensionChecks", []):
        for group in ("correctLines", "wrongLines"):
            for line in check.get(group, []):
                seen[line["id"]] = line

    for interactive in story.get("interactives", []):
        for response in interactive.get("responses", {}).values():
            for line in response.get("lines", []):
                seen[line["id"]] = line
            for variant in response.get("variants", []):
                for line in variant:
                    seen[line["id"]] = line

    return list(seen.values())


def build_powershell_script(text: str, voice_name: str, output_path: Path, rate: int) -> str:
    escaped_text = text.replace("'", "''")
    escaped_voice = voice_name.replace("'", "''")
    escaped_output = str(output_path).replace("'", "''")

    return f"""
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('{escaped_voice}')
$synth.Rate = {rate}
$synth.SetOutputToWaveFile('{escaped_output}')
$synth.Speak('{escaped_text}')
$synth.Dispose()
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate dialogue audio for English Office Mystery."
    )
    parser.add_argument(
        "--provider",
        choices=("auto", "edge", "gtts", "system"),
        default="auto",
        help="Preferred TTS provider. 'auto' tries edge-tts, then gTTS, then Windows system voices.",
    )
    parser.add_argument(
        "--only",
        nargs="*",
        default=[],
        help="Optional list of line ids to regenerate.",
    )
    parser.add_argument(
        "--story-path",
        default=str(DEFAULT_STORY_PATH),
        help="Path to the story JSON file.",
    )
    parser.add_argument(
        "--audio-dir",
        default=str(DEFAULT_AUDIO_DIR),
        help="Directory where generated dialogue audio should be written.",
    )
    return parser.parse_args()


def get_provider_order(requested: str) -> list[str]:
    if requested != "auto":
        return [requested]

    provider_order: list[str] = []

    if edge_tts is not None:
        provider_order.append("edge")

    if gTTS is not None:
        provider_order.append("gtts")

    provider_order.append("system")
    return provider_order


def get_speaker_config(line: dict, speakers: dict) -> dict:
    return speakers[line["speaker"]]


def normalize_edge_value(value: str | None, suffix: str) -> str:
    if not value:
        return f"+0{suffix}"

    text = str(value).strip()
    if re.fullmatch(r"[+-]?\d+(?:\.\d+)?", text):
        number = text if text.startswith(("+", "-")) else f"+{text}"
        return f"{number}{suffix}"

    if re.fullmatch(r"[+-]?\d+(?:\.\d+)?%?", text) and suffix == "%":
        if text.endswith("%"):
            return text if text.startswith(("+", "-")) else f"+{text}"
        number = text if text.startswith(("+", "-")) else f"+{text}"
        return f"{number}%"

    if re.fullmatch(r"[+-]?\d+(?:\.\d+)?Hz?", text) and suffix == "Hz":
        if text.endswith("Hz"):
            return text if text.startswith(("+", "-")) else f"+{text}"
        number = text if text.startswith(("+", "-")) else f"+{text}"
        return f"{number}Hz"

    return text


def pad_leading_silence(output_path: Path) -> None:
    if FFMPEG_PATH is None or not output_path.exists():
        return

    padded_path = output_path.with_name(f"{output_path.stem}-padded{output_path.suffix}")
    codec_args = ["-c:a", "pcm_s16le"] if output_path.suffix == ".wav" else ["-codec:a", "libmp3lame", "-q:a", "2"]
    subprocess.run(
        [
            FFMPEG_PATH,
            "-y",
            "-i",
            str(output_path),
            "-af",
            f"adelay={LEADING_SILENCE_MS}:all=true,loudnorm=I=-16:TP=-1.5:LRA=11",
            *codec_args,
            str(padded_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    padded_path.replace(output_path)


async def synthesize_with_edge(line: dict, speaker: dict) -> Path:
    if edge_tts is None:
        raise RuntimeError("edge-tts is not installed.")

    output_path = AUDIO_DIR / f"{line['id']}.mp3"
    communicate = edge_tts.Communicate(
        line["text"],
        speaker.get("naturalVoice", DEFAULT_EDGE_VOICE),
        rate=normalize_edge_value(speaker.get("naturalRate", DEFAULT_EDGE_RATE), "%"),
        volume=normalize_edge_value(speaker.get("naturalVolume", DEFAULT_EDGE_VOLUME), "%"),
        pitch=normalize_edge_value(speaker.get("naturalPitch", DEFAULT_EDGE_PITCH), "Hz"),
    )
    await communicate.save(output_path)
    pad_leading_silence(output_path)
    return output_path


def synthesize_with_gtts(line: dict, speaker: dict) -> Path:
    if gTTS is None:
        raise RuntimeError("gTTS is not installed.")

    output_path = AUDIO_DIR / f"{line['id']}.mp3"
    tts = gTTS(
        text=line["text"],
        lang=speaker.get("gttsLang", "en"),
        tld=speaker.get("gttsTld", "com"),
        slow=speaker.get("gttsSlow", True),
    )
    tts.save(str(output_path))
    pad_leading_silence(output_path)
    return output_path


def synthesize_with_system(line: dict, speaker: dict) -> Path:
    output_path = AUDIO_DIR / f"{line['id']}.wav"
    command = build_powershell_script(
        line["text"],
        speaker["voice"],
        output_path,
        speaker.get("systemRate", DEFAULT_SYSTEM_RATE),
    )
    subprocess.run(
        ["powershell", "-NoProfile", "-Command", command],
        check=True,
        capture_output=True,
        text=True,
    )
    pad_leading_silence(output_path)
    return output_path


def synthesize_line(line: dict, speakers: dict, provider_order: list[str]) -> tuple[str, Path]:
    speaker = get_speaker_config(line, speakers)
    last_error: Exception | None = None

    for provider in provider_order:
        try:
            if provider == "edge":
                output_path = asyncio.run(synthesize_with_edge(line, speaker))
            elif provider == "gtts":
                output_path = synthesize_with_gtts(line, speaker)
            elif provider == "system":
                output_path = synthesize_with_system(line, speaker)
            else:
                raise RuntimeError(f"Unsupported provider: {provider}")

            return provider, output_path
        except Exception as exc:  # pragma: no cover - network/provider dependent
            last_error = exc
            print(f"Provider {provider} failed for {line['id']}: {exc}")

    raise RuntimeError(f"Could not generate audio for {line['id']}: {last_error}")


def main() -> None:
    args = parse_args()
    story_path = Path(args.story_path).resolve()
    audio_dir = Path(args.audio_dir).resolve()
    audio_dir.mkdir(parents=True, exist_ok=True)
    story = json.loads(story_path.read_text(encoding="utf-8"))
    lines = collect_lines(story)
    provider_order = get_provider_order(args.provider)

    if args.only:
        only = set(args.only)
        lines = [line for line in lines if line["id"] in only]

    print(
        f"Generating {len(lines)} audio files into {audio_dir} "
        f"with provider order: {', '.join(provider_order)}"
    )

    global AUDIO_DIR
    AUDIO_DIR = audio_dir

    for line in lines:
        provider, output_path = synthesize_line(line, story["speakers"], provider_order)
        print(f"Created {output_path.name} with {provider}")

    print("Audio generation complete.")


if __name__ == "__main__":
    main()
