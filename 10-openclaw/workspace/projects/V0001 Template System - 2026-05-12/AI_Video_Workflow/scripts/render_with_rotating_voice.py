#!/usr/bin/env python3
"""Render the approved 20s video with rotating voice and background music.

Important: normal automation generates a NEW voiceover on every run from the
current script text, using the selected rotating voice identity. The old fixed
sample audio files are fallback/debug only.

Background music can also rotate. Drop music files into the configured
music_rotation directory and the renderer will use them in sorted filename order:
video 1 -> music 1, video 2 -> music 2, ... video 8 -> music 1 when 7 files exist.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import shlex
import shutil
import subprocess
import time
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "config" / "voice_rotation_config.json"
DEFAULT_STATE = ROOT / "config" / "voice_rotation_state.json"
DEFAULT_OUTPUT_DIR = ROOT / "output" / "rotating_voice_renders"


def load_json(path: pathlib.Path) -> dict:
    return json.loads(path.read_text())


def write_json(path: pathlib.Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def resolve_master_path(raw: str) -> pathlib.Path:
    p = pathlib.Path(raw)
    if p.is_absolute():
        return p
    return (ROOT / p).resolve()


def voice_for_number(config: dict, number: int) -> dict:
    voices = config["voices"]
    if not voices:
        raise ValueError("voice_rotation_config.json has no voices")
    normalized_number = ((int(number) - 1) % len(voices)) + 1
    for voice in voices:
        if int(voice["number"]) == normalized_number:
            return voice
    raise ValueError(f"No configured voice for number {normalized_number}")


def discover_music_tracks(config: dict) -> list[dict]:
    """Return configured/auto-discovered background music tracks in stable order."""
    rotation = config.get("music_rotation", {})
    supported = {ext.lower() for ext in rotation.get("supported_extensions", [".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"])}

    if rotation.get("enabled", False):
        music_dir_raw = rotation.get("directory")
        if music_dir_raw:
            music_dir = resolve_master_path(music_dir_raw)
            if music_dir.exists():
                files = sorted(p for p in music_dir.iterdir() if p.is_file() and p.suffix.lower() in supported)
                if files:
                    return [
                        {"number": i + 1, "name": path.stem, "path": str(path)}
                        for i, path in enumerate(files)
                    ]

    tracks = config.get("music_tracks") or []
    if tracks:
        return tracks

    # Backwards-compatible fallback to the old single music file.
    if config.get("music"):
        legacy = pathlib.Path(config["music"]).name
        return [{"number": 1, "name": legacy, "path": config["music"]}]

    return []


def music_for_number(config: dict, number: int) -> dict:
    tracks = discover_music_tracks(config)
    if not tracks:
        raise ValueError("No music tracks configured/found")
    normalized_number = ((int(number) - 1) % len(tracks)) + 1
    return tracks[normalized_number - 1]


def next_number_after(number: int, total: int) -> int:
    return (int(number) % int(total)) + 1


def planned_sequence(config: dict, start_voice_number: int, start_music_number: int, count: int) -> list[dict]:
    total_voices = len(config["voices"])
    total_music = len(discover_music_tracks(config))
    seq = []
    voice_n = start_voice_number
    music_n = start_music_number
    for i in range(count):
        voice = voice_for_number(config, voice_n)
        music = music_for_number(config, music_n)
        seq.append({
            "video_offset": i + 1,
            "voice_number": voice["number"],
            "voice_name": voice["name"],
            "gender": voice.get("gender"),
            "music_number": music["number"],
            "music_name": music.get("name") or pathlib.Path(music["path"]).name,
            "music_path": music["path"],
            "generation": "fresh_voiceover_each_run",
        })
        voice_n = next_number_after(voice_n, total_voices)
        music_n = next_number_after(music_n, total_music)
    return seq


def read_env_value(env_file: pathlib.Path, key: str) -> str | None:
    if not env_file.exists():
        return None
    for line in env_file.read_text(errors="ignore").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        if k.strip() == key:
            return v.strip().strip('"').strip("'")
    return None


def run(cmd: list[str | pathlib.Path]) -> None:
    cmd = [str(x) for x in cmd]
    print("+", " ".join(shlex.quote(x) for x in cmd), flush=True)
    subprocess.run(cmd, check=True)


def run_capture(cmd: list[str | pathlib.Path]) -> str:
    cmd = [str(x) for x in cmd]
    print("+", " ".join(shlex.quote(x) for x in cmd), flush=True)
    return subprocess.check_output(cmd, text=True)


def duration_seconds(path: pathlib.Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", str(path),
    ], text=True).strip()
    return float(out)


def section_text(section_root: pathlib.Path, section_name: str) -> str:
    cfg = load_json(section_root / "config" / f"{section_name}_config.json")
    if section_name == "section1":
        text = cfg.get("headline_text")
        if not text and cfg.get("text_reveal_steps"):
            text = cfg["text_reveal_steps"][-1].get("text")
        return " ".join(str(text or "").split())
    if section_name == "section3":
        return " ".join(str(x).strip() for x in cfg.get("text_lines", []) if str(x).strip())
    raise ValueError(f"Unsupported contextual section: {section_name}")


def build_wan_prompt(config: dict, section_name: str, text: str) -> str:
    vg = config.get("contextual_video_generation", {})
    templates = vg.get("prompt_templates", {})
    default_template = (
        "Vertical 9:16 cinematic professional background video contextually matching this script text: {text}. "
        "Modern premium SaaS/business visual style, subtle camera movement, high quality, no readable text, "
        "no captions, no subtitles, no logos, no watermark."
    )
    template = templates.get(section_name, default_template)
    return template.format(text=text)


def generate_replicate_wan_clip(config: dict, section_name: str, text: str, output_path: pathlib.Path, label: str | None) -> pathlib.Path:
    """Generate a contextual 5s section clip using Replicate WAN."""
    try:
        import requests
    except ImportError as exc:
        raise RuntimeError("The 'requests' Python package is required for WAN generation") from exc

    vg = config.get("contextual_video_generation", {})
    if not vg.get("enabled", False):
        raise ValueError("contextual_video_generation.enabled is false in config")
    if vg.get("provider", "replicate") != "replicate":
        raise ValueError("Only Replicate contextual video generation is currently implemented")

    env_key = vg.get("api_token_env", "REPLICATE_API_TOKEN")
    env_file = resolve_master_path(vg.get("env_file", "../../../.env"))
    api_token = read_env_value(env_file, env_key)
    if not api_token:
        raise RuntimeError(f"{env_key} not found in {env_file}")

    model = vg.get("model", "wan-video/wan-2.7-t2v")
    prompt = build_wan_prompt(config, section_name, text)
    negative_prompt = vg.get(
        "negative_prompt",
        "dull colors, desaturated, grey washed out color, low contrast, blur, distortion, watermark, logo, captions, subtitles, readable text, gibberish text, bad anatomy, flicker",
    )
    body = {
        "input": {
            "prompt": prompt,
            "duration": int(vg.get("duration", 5)),
            "resolution": vg.get("resolution", "1080p"),
            "aspect_ratio": vg.get("aspect_ratio", "9:16"),
            "negative_prompt": negative_prompt,
            "enable_prompt_expansion": bool(vg.get("enable_prompt_expansion", True)),
        }
    }
    headers = {"Authorization": f"Bearer {api_token}", "Content-Type": "application/json", "Prefer": "wait=5"}

    output_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path = output_path.with_suffix(output_path.suffix + ".json")
    print(f"Generate WAN contextual clip: {section_name} / {model}", flush=True)
    while True:
        r = requests.post(f"https://api.replicate.com/v1/models/{model}/predictions", headers=headers, json=body, timeout=90)
        print("submit", section_name, r.status_code, r.text[:350], flush=True)
        if r.status_code == 429:
            time.sleep(int(r.headers.get("Retry-After", "10")) + 2)
            continue
        r.raise_for_status()
        prediction = r.json()
        break

    pred_id = prediction["id"]
    while True:
        r = requests.get(f"https://api.replicate.com/v1/predictions/{pred_id}", headers={"Authorization": f"Bearer {api_token}"}, timeout=60)
        r.raise_for_status()
        result = r.json()
        print(section_name, result.get("status"), flush=True)
        if result.get("status") in ("succeeded", "failed", "canceled"):
            break
        time.sleep(int(vg.get("poll_seconds", 15)))

    if result.get("status") != "succeeded":
        raise RuntimeError(f"WAN generation failed for {section_name}: {result.get('error') or result}")
    out = result.get("output")
    url = out[0] if isinstance(out, list) else out
    if not url:
        raise RuntimeError(f"WAN generation produced no output for {section_name}: {result}")
    urllib.request.urlretrieve(url, output_path)
    meta_path.write_text(json.dumps({
        "section": section_name,
        "label": label,
        "text": text,
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "model": model,
        "prediction_id": pred_id,
        "url": url,
        "downloaded": str(output_path),
        "result": result,
    }, indent=2) + "\n")
    return output_path


def render_contextual_sections_and_base(config: dict, label: str | None) -> pathlib.Path:
    """Generate WAN clips for sections 1/3, render those sections, then rebuild the 20s base video."""
    safe_label = re.sub(r"[^A-Za-z0-9_.-]+", "_", label or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
    vg = config.get("contextual_video_generation", {})
    raw_dir = resolve_master_path(vg.get("output_dir", "assets/wan_contextual_clips"))
    rendered = {}

    for section_name in ("section1", "section3"):
        section_root = ROOT.parent / section_name
        text = section_text(section_root, section_name)
        raw_clip = raw_dir / f"{safe_label}_{section_name}_wan.mp4"
        generate_replicate_wan_clip(config, section_name, text, raw_clip, safe_label)

        cfg_path = section_root / "config" / f"{section_name}_config.json"
        section_cfg = load_json(cfg_path)
        section_cfg["clip_path"] = str(raw_clip)
        section_cfg["audio_path"] = None
        section_cfg["output_name"] = f"{section_name}_contextual_wan_{safe_label}.mp4"
        temp_cfg = section_root / "config" / f".{section_name}_contextual_{safe_label}.json"
        write_json(temp_cfg, section_cfg)
        run(["python3", section_root / "scripts" / f"render_{section_name}.py", temp_cfg])
        rendered[section_name] = section_root / "output" / section_cfg["output_name"]

    full_cfg_path = ROOT / "config" / "full_video_config.json"
    full_cfg = load_json(full_cfg_path)
    full_cfg["output_name"] = f"traitdna_full_20s_contextual_wan_{safe_label}.mp4"
    for sec in full_cfg["sections"]:
        if sec["id"].startswith("section1_"):
            sec["source"] = str(rendered["section1"])
        elif sec["id"].startswith("section3_"):
            sec["source"] = str(rendered["section3"])
    temp_full_cfg = ROOT / "config" / f".full_contextual_wan_{safe_label}.json"
    write_json(temp_full_cfg, full_cfg)
    run(["python3", ROOT / "scripts" / "render_full_video.py", temp_full_cfg])
    return ROOT / "output" / full_cfg["output_name"]


def generate_replicate_voiceover(config: dict, voice: dict, text: str, label: str | None) -> pathlib.Path:
    gen = config.get("voiceover_generation", {})
    if gen.get("provider") != "replicate":
        raise ValueError("Only Replicate voiceover_generation is currently implemented")

    env_key = gen.get("api_token_env", "REPLICATE_API_TOKEN")
    env_file = resolve_master_path(gen.get("env_file", "../../.env"))
    api_token = read_env_value(env_file, env_key)
    if not api_token:
        raise RuntimeError(f"{env_key} not found in {env_file}")

    version = gen["version"]
    settings = gen.get("settings", {})
    replicate_voice = voice.get("replicate_voice") or voice["name"]

    out_dir = resolve_master_path(gen.get("generated_audio_dir", "audio/rotating_voice_generated"))
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    safe_name = voice["name"].lower().replace(" ", "_")
    suffix = label or stamp
    raw = out_dir / f"voice_{int(voice['number']):02d}_{safe_name}_{suffix}_raw.mp3"
    fitted = out_dir / f"voice_{int(voice['number']):02d}_{safe_name}_{suffix}_fitted.mp3"

    payload = {
        "version": version,
        "input": {
            "prompt": text,
            "voice": replicate_voice,
            "stability": settings.get("stability", 0.5),
            "similarity_boost": settings.get("similarity_boost", 0.8),
            "style": settings.get("style", 0.0),
            "speed": settings.get("speed", 1.0),
            "language_code": settings.get("language_code", "en"),
        },
    }
    headers = {
        "Authorization": f"Token {api_token}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }
    req = urllib.request.Request(
        "https://api.replicate.com/v1/predictions",
        data=json.dumps(payload).encode(),
        headers=headers,
        method="POST",
    )
    print(f"Generate VO: Replicate ElevenLabs voice {voice['number']} / {voice['name']}", flush=True)
    with urllib.request.urlopen(req, timeout=180) as response:
        prediction = json.loads(response.read().decode())
    if prediction.get("status") != "succeeded":
        raise RuntimeError(f"Replicate prediction failed: {prediction}")
    audio_url = prediction.get("output")
    if isinstance(audio_url, list):
        audio_url = audio_url[0]
    if not audio_url:
        raise RuntimeError(f"Replicate prediction missing audio output: {prediction}")
    with urllib.request.urlopen(audio_url, timeout=180) as response, raw.open("wb") as f:
        f.write(response.read())

    raw_dur = duration_seconds(raw)
    fit_to = float(gen.get("fit_to_seconds", 18.9))
    if raw_dur > fit_to:
        tempo = raw_dur / fit_to
        run(["ffmpeg", "-y", "-i", raw, "-filter:a", f"atempo={tempo:.5f}", "-c:a", "libmp3lame", "-b:a", "128k", fitted])
    else:
        shutil.copyfile(raw, fitted)

    meta = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "voice_number": voice["number"],
        "voice_name": voice["name"],
        "replicate_voice": replicate_voice,
        "prediction_id": prediction.get("id"),
        "raw_audio_url": audio_url,
        "raw_duration": raw_dur,
        "fitted_duration": duration_seconds(fitted),
        "script_text": text,
        "raw_audio": str(raw),
        "fitted_audio": str(fitted),
    }
    fitted.with_suffix(".json").write_text(json.dumps(meta, indent=2) + "\n")
    return fitted


def get_audio_for_run(config: dict, voice: dict, text: str, label: str | None, use_fixed_audio: bool) -> pathlib.Path:
    if use_fixed_audio:
        audio = resolve_master_path(voice["audio"])
        if not audio.exists():
            raise FileNotFoundError(f"Missing fallback fixed audio: {audio}")
        return audio
    return generate_replicate_voiceover(config, voice, text, label)


def ensure_video_music(config: dict, music_track: dict, base_video_override: pathlib.Path | None = None) -> tuple[pathlib.Path, pathlib.Path]:
    video = base_video_override if base_video_override is not None else resolve_master_path(config["base_video"])
    music = resolve_master_path(music_track["path"])
    missing = [str(p) for p in (video, music) if not p.exists()]
    if missing:
        raise FileNotFoundError("Missing required input(s): " + ", ".join(missing))
    return video, music


def render(config: dict, voice: dict, music_track: dict, audio: pathlib.Path, output_dir: pathlib.Path, label: str | None, base_video_override: pathlib.Path | None = None) -> pathlib.Path:
    video, music = ensure_video_music(config, music_track, base_video_override)
    if not audio.exists():
        raise FileNotFoundError(f"Missing voiceover audio: {audio}")
    output_dir.mkdir(parents=True, exist_ok=True)

    duration = float(config.get("target_duration_seconds", 20))
    music_start = float(config.get("music_source_start_seconds", 1.0))
    music_volume = float(config.get("music_volume", 0.32))
    delay_ms = int(config.get("voice_delay_ms", 250))
    loud = config.get("voice_loudnorm", {})
    loud_i = float(loud.get("I", -16))
    loud_tp = float(loud.get("TP", -1.5))
    loud_lra = float(loud.get("LRA", 11))
    post_volume = float(loud.get("post_volume", 1.05))

    safe_name = voice["name"].lower().replace(" ", "_")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    suffix = label or stamp
    out = output_dir / f"traitdna_rotating_voice_{int(voice['number']):02d}_{safe_name}_{suffix}.mp4"

    filter_complex = (
        f"[1:a]adelay={delay_ms}|{delay_ms},"
        f"loudnorm=I={loud_i}:TP={loud_tp}:LRA={loud_lra},"
        f"volume={post_volume},apad=pad_dur={duration},atrim=0:{duration}[vo];"
        f"[2:a]atrim=0:{duration},volume={music_volume}[music];"
        f"[vo][music]amix=inputs=2:duration=longest:dropout_transition=0,"
        f"alimiter=limit=0.95,atrim=0:{duration}[aout]"
    )

    run([
        "ffmpeg", "-y",
        "-i", video,
        "-i", audio,
        "-ss", str(music_start), "-i", music,
        "-filter_complex", filter_complex,
        "-map", "0:v:0", "-map", "[aout]",
        "-t", str(duration),
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        out,
    ])

    with out.with_suffix(out.suffix + ".ffprobe.json").open("w") as f:
        subprocess.run([
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration,size,bit_rate:stream=width,height,codec_name,r_frame_rate",
            "-of", "json", str(out),
        ], check=True, stdout=f)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Render with persistent voice + music rotation and fresh VO generation")
    parser.add_argument("--config", type=pathlib.Path, default=DEFAULT_CONFIG)
    parser.add_argument("--state", type=pathlib.Path, default=DEFAULT_STATE)
    parser.add_argument("--output-dir", type=pathlib.Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--voiceover-text-file", type=pathlib.Path, help="Current script text file for fresh VO generation")
    parser.add_argument("--text", help="Current script text directly")
    parser.add_argument("--use-fixed-audio", action="store_true", help="Debug only: use old fixed sample audio instead of generating fresh VO")
    parser.add_argument("--video-number", type=int, help="Use deterministic voice/music for video N: ((N-1) %% total_items) + 1")
    parser.add_argument("--generate-contextual-clips", action="store_true", help="Generate fresh WAN video clips for sections 1 and 3 from their text before final render")
    parser.add_argument("--count", type=int, default=12, help="How many upcoming items to show with --dry-run")
    parser.add_argument("--peek", action="store_true", help="Print next voice and exit")
    parser.add_argument("--dry-run", action="store_true", help="Print upcoming rotation sequence and exit")
    parser.add_argument("--no-advance", action="store_true", help="Do not update rotation state after render")
    parser.add_argument("--label", help="Output filename suffix, e.g. client_video_001")
    args = parser.parse_args()

    config = load_json(args.config)
    state = load_json(args.state) if args.state.exists() else {
        "rotation_name": config.get("rotation_name"),
        "next_voice_number": 1,
        "next_music_number": 1,
        "total_videos_created_with_rotation": 0,
        "history": [],
    }

    total_voices = len(config["voices"])
    total_music = len(discover_music_tracks(config))
    if total_music <= 0:
        raise ValueError("No background music tracks found/configured")

    start_voice_number = ((args.video_number - 1) % total_voices) + 1 if args.video_number else int(state.get("next_voice_number", 1))
    start_music_number = ((args.video_number - 1) % total_music) + 1 if args.video_number else int(state.get("next_music_number", 1))
    selected = voice_for_number(config, start_voice_number)
    selected_music = music_for_number(config, start_music_number)

    if args.peek:
        print(json.dumps({
            "next_voice_number": selected["number"],
            "next_voice_name": selected["name"],
            "gender": selected.get("gender"),
            "next_music_number": selected_music["number"],
            "next_music_name": selected_music.get("name") or pathlib.Path(selected_music["path"]).name,
            "next_music_path": selected_music["path"],
            "generation": "fresh_voiceover_each_run",
            "source": "video-number" if args.video_number else "state",
        }, indent=2))
        return

    if args.dry_run:
        print(json.dumps(planned_sequence(config, start_voice_number, start_music_number, args.count), indent=2))
        return

    if args.text:
        script_text = args.text.strip()
    else:
        text_file = args.voiceover_text_file
        if text_file is None:
            text_file = resolve_master_path(config.get("voiceover_generation", {}).get("default_text_file", "audio/female_full_vo_v1/full_voiceover.txt"))
        elif not text_file.is_absolute():
            text_file = (pathlib.Path.cwd() / text_file).resolve()
        script_text = text_file.read_text(errors="ignore").strip()
    if not script_text:
        raise ValueError("Voiceover script text is empty")

    base_video_override = render_contextual_sections_and_base(config, args.label) if args.generate_contextual_clips else None
    audio = get_audio_for_run(config, selected, script_text, args.label, args.use_fixed_audio)
    out = render(config, selected, selected_music, audio, args.output_dir, args.label, base_video_override)

    if not args.no_advance and not args.video_number:
        state["last_used_voice_number"] = selected["number"]
        state["last_used_voice_name"] = selected["name"]
        state["last_used_music_number"] = selected_music["number"]
        state["last_used_music_name"] = selected_music.get("name") or pathlib.Path(selected_music["path"]).name
        state["last_used_music_path"] = selected_music["path"]
        state["last_generated_audio"] = str(audio)
        if base_video_override is not None:
            state["last_contextual_base_video"] = str(base_video_override)
        state["last_output"] = str(out)
        state["total_videos_created_with_rotation"] = int(state.get("total_videos_created_with_rotation", 0)) + 1
        state["next_voice_number"] = next_number_after(selected["number"], total_voices)
        state["next_music_number"] = next_number_after(selected_music["number"], total_music)
        history = state.setdefault("history", [])
        history.append({
            "created_at": datetime.now(timezone.utc).isoformat(),
            "voice_number": selected["number"],
            "voice_name": selected["name"],
            "music_number": selected_music["number"],
            "music_name": selected_music.get("name") or pathlib.Path(selected_music["path"]).name,
            "music_path": selected_music["path"],
            "contextual_base_video": str(base_video_override) if base_video_override is not None else None,
            "generated_audio": str(audio),
            "output": str(out),
        })
        state["history"] = history[-100:]
        write_json(args.state, state)

    print(json.dumps({
        "output": str(out),
        "generated_audio": str(audio),
        "voice_number": selected["number"],
        "voice_name": selected["name"],
        "music_number": selected_music["number"],
        "music_name": selected_music.get("name") or pathlib.Path(selected_music["path"]).name,
        "music_path": selected_music["path"],
        "contextual_base_video": str(base_video_override) if base_video_override is not None else None,
        "next_voice_number": None if args.no_advance or args.video_number else state.get("next_voice_number"),
        "next_music_number": None if args.no_advance or args.video_number else state.get("next_music_number"),
        "generation": "fixed_audio_debug" if args.use_fixed_audio else "fresh_voiceover_generated",
    }, indent=2))


if __name__ == "__main__":
    main()
