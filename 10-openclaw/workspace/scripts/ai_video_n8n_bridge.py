#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys
import shutil
import importlib.util
from copy import deepcopy
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

WORKSPACE = Path('/root/.openclaw/workspace')
PROJECT = WORKSPACE / 'projects' / 'V0001 Template System - 2026-05-12'
MASTER = PROJECT / 'master'
DEFAULT_DRIVE_FOLDER = '1EyEPyPk6orAkP1abcqivX_GwsaQKnYmP'

VOICE_CONFIG = MASTER / 'config' / 'voice_rotation_config.json'
VOICE_STATE = MASTER / 'config' / 'voice_rotation_state.json'
ROTATING_OUTPUT_DIR = MASTER / 'output' / 'rotating_voice_renders'
RENDER_WITH_ROTATING = MASTER / 'scripts' / 'render_with_rotating_voice.py'


def load_wan_module():
    spec = importlib.util.spec_from_file_location('render_with_rotating_voice', RENDER_WITH_ROTATING)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def wan_config():
    cfg = load_json(VOICE_CONFIG)
    cfg.setdefault('contextual_video_generation', {})
    vg = cfg['contextual_video_generation']
    vg['enabled'] = True
    vg['model'] = 'kwaivgi/kling-v2.6'
    vg['generate_audio'] = False
    vg['negative_prompt'] = (
        'text, subtitles, logo, visible laptop screen, readable screen, UI overlay, chart, graph, branding, cartoon, animation, CGI, hologram, serious expression unless context requires it, distorted face, distorted hands, extra fingers, fast camera movement, shaky camera, low quality'
    )
    vg.setdefault('prompt_templates', {})
    base_prompt = 'Create a realistic 5-second vertical 9:16 professional B-roll video.\n\nUser context:\n{USER_TEXT}\n\nAudience:\nSoftware developers. The person must read clearly as a developer within the first second, not a generic corporate employee. Use the context only for mood/activity. Do not show or write the text.\n\nStyle:\nRealistic cinematic footage, polished career-tech feel, warm natural light, shallow depth of field, clean professional setting.\n\nScene:\nA calm, approachable software developer seated at a modern engineering desk or home-office tech setup, using a laptop with at least one external monitor plus an external keyboard or mouse. Include at least 4 developer cues: hoodie, plain t-shirt, casual overshirt, headphones, external monitor, dual monitors, mechanical keyboard, mouse, engineering desk, blank sticky notes with no readable text, dark IDE-like glow, blurred terminal blocks, code-editor color ambience, tech workspace.\n\nMood:\nOptimistic, focused, confident, professional. Calm focused expression or subtle natural smile only. Avoid posed corporate smiles and clutter.\n\nCamera:\nBack-side, side-angle, or over-the-shoulder view; preferably 3/4 rear or side-rear. Camera observes from behind or side, never front-facing. Smooth slow push-in, slow zoom, or subtle side movement only.\n\nScreens:\nScreens face the subject, not the camera. Show monitor back, monitor edge, or partial angled glimpse only. Screens may suggest developer work through soft dark glow, blurred IDE-like layouts, terminal-like blurred blocks, or code-editor color ambience. No readable text, code, UI labels, charts, documents, logos, or branding. Avoid direct screen views.\n\nComposition:\nWide medium shot with extra headroom. Keep person, desk, hands, keyboard, devices, props, and action in the lower half/lower third. Top 25-30% must stay clean empty negative space for text overlay: plain wall, ceiling, soft blur, or calm background only. Do not place face, head, laptop, monitor, hands, props, or busy details in the top 25-30%.\n\nAvoid:\nblazers, suits, formal shirts, boardrooms, conference rooms, handshakes, meetings, sales offices, generic corporate footage, manager presentation, laptop-only generic work, stock-photo smile, on-screen text, subtitles, logos, readable code/UI/charts/documents, cartoons, animation, holograms, futuristic effects, distorted face/hands, extra fingers, fast motion, shaky camera, low quality.'
    vg['prompt_templates']['section1'] = base_prompt
    vg['prompt_templates']['section3'] = base_prompt
    return cfg


def load_json(path: Path):
    return json.loads(path.read_text())


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + '\n')


def safe_label(raw: str) -> str:
    raw = raw or datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    return re.sub(r'[^A-Za-z0-9_.-]+', '_', raw).strip('_')[:90] or 'video'


def wrap_lines(text: str, max_lines=5, max_chars=18):
    text = ' '.join(str(text or '').replace('\n', ' ').split())
    if not text:
        return []
    words = text.split()
    lines = []
    cur = ''
    for w in words:
        if not cur:
            cur = w
        elif len(cur) + 1 + len(w) <= max_chars:
            cur += ' ' + w
        else:
            lines.append(cur)
            cur = w
            if len(lines) >= max_lines - 1:
                break
    rest_words = words[sum(len(x.split()) for x in lines):]
    if rest_words:
        cur = ' '.join(rest_words)
    if cur:
        lines.append(cur)
    return lines[:max_lines]


def reveal_steps_from_text(text: str):
    lines = wrap_lines(text, max_lines=5, max_chars=18)
    if not lines:
        lines = ['Most Software', 'Developers', 'qualify for more', 'job titles than', 'they apply to.']
    cumulative = []
    for i in range(len(lines)):
        cumulative.append('\n'.join(lines[:i+1]))
    starts = [0.0, 0.2, 0.42, 0.68, 1.0]
    ends = [0.2, 0.42, 0.68, 1.0, 4.86]
    steps = []
    for i, txt in enumerate(cumulative[:5]):
        steps.append({'start': starts[min(i, 4)], 'end': ends[min(i, 4)], 'text': txt})
    if steps[-1]['end'] < 4.86:
        steps[-1]['end'] = 4.86
    return steps


def compose_voiceover_text(row: dict, hook: str, insight: str, implication: str, cta: str, cta_sub: str) -> str:
    # TraitDNA BatchFlow template rule, approved from V0001:
    # voiceover must be built from the first four script fields only.
    # Never use sheet Voiceover_Text when present, because that column may
    # include CTA Sub Text / final sheet column and makes the VO too long.
    # CTA Sub Text remains visual-only in Section 4.
    text = ' '.join(x for x in [hook, insight, implication, cta] if x)
    text = str(text).replace('~', 'approximately ')
    text = text.replace('™', '').replace('—', ', ')
    text = re.sub(r'\s+', ' ', text).strip()
    text = text.replace('TraitDNA', 'Trait DNA')
    return text


def normalize_voice_text(text: str) -> str:
    text = str(text or '').replace('~', 'approximately ')
    text = text.replace('™', '').replace('—', ', ')
    text = re.sub(r'\s+', ' ', text).strip()
    text = text.replace('TraitDNA', 'Trait DNA')
    return text


def ffprobe_duration(path: Path) -> float:
    out = subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=nw=1:nk=1', str(path),
    ], text=True, timeout=30).strip()
    return float(out)


def quantize_frame(seconds: float, fps: int = 30) -> float:
    return round(float(seconds) * fps) / fps


def dynamic_section_timing(vo_durations: list[float], fps: int = 30) -> dict:
    """Calculate adaptive 4-section timing from natural VO durations.

    Baseline is four 5s visual sections. Voice speed is never changed.
    If total VO fits in 20s, final output stays exactly 20s by trimming short
    sections, extending long sections with frozen frames, and using up to 0.5s
    silent hold gaps between sections. If VO alone exceeds 20s, no gaps are
    added and the video is allowed to run longer.
    """
    target = 20.0
    preferred_gap = 0.5
    n_gaps = 3
    total_vo = sum(vo_durations)
    if total_vo >= target:
        gaps = [0.0, 0.0, 0.0]
        pads = [0.0, 0.0, 0.0, 0.0]
        final_duration = total_vo
    else:
        gap_each = min(preferred_gap, max(0.0, (target - total_vo) / n_gaps))
        gaps = [gap_each, gap_each, gap_each]
        pad_total = max(0.0, target - total_vo - sum(gaps))
        # Give all sections a small natural hold first, then put remaining
        # breathing room mostly where it is least disruptive: CTA/end and
        # shorter sections. This keeps long insight sections from feeling rushed
        # while preserving exactly 20s when VO fits.
        pads = [0.0, 0.0, 0.0, 0.0]
        base_hold = min(0.20, pad_total / 4) if pad_total > 0 else 0.0
        for i in range(4):
            pads[i] += base_hold
        pad_total -= base_hold * 4
        weights = [1.0, 0.6, 1.0, 1.4]
        wsum = sum(weights)
        for i, w in enumerate(weights):
            pads[i] += pad_total * (w / wsum)
        final_duration = target

    content = [quantize_frame(d + p, fps) for d, p in zip(vo_durations, pads)]
    gaps = [quantize_frame(g, fps) for g in gaps]
    # Correct tiny rounding drift on the final content section when targeting 20s.
    if total_vo < target:
        drift = target - (sum(content) + sum(gaps))
        content[-1] = max(quantize_frame(vo_durations[-1], fps), quantize_frame(content[-1] + drift, fps))
        # If the final section cannot absorb negative drift because it would
        # cut into VO, reduce silent gaps first. This keeps videos at 20s when
        # VO fits, instead of letting frame rounding create 20.03s outputs.
        overflow = (sum(content) + sum(gaps)) - target
        if overflow > (0.5 / fps):
            for i in reversed(range(len(gaps))):
                take = min(gaps[i], overflow)
                gaps[i] = quantize_frame(gaps[i] - take, fps)
                overflow = (sum(content) + sum(gaps)) - target
                if overflow <= (0.5 / fps):
                    break
        final_duration = sum(content) + sum(gaps)
    starts = []
    t = 0.0
    for i in range(4):
        starts.append(quantize_frame(t, fps))
        t += content[i]
        if i < 3:
            t += gaps[i]
    return {
        'target_duration': target,
        'total_voiceover_duration': total_vo,
        'final_duration': quantize_frame(final_duration, fps),
        'section_content_durations': content,
        'section_gap_after': gaps,
        'section_total_durations': [content[i] + (gaps[i] if i < 3 else 0.0) for i in range(4)],
        'section_starts': starts,
        'voiceover_durations': vo_durations,
        'voice_speed_policy': 'natural_no_speed_change',
    }


def render_dynamic_full_video(sources: dict, label: str, timing: dict, fps: int = 30) -> Path:
    out_dir = MASTER / 'output'
    work = MASTER / 'work' / f'dynamic_timing_{label}'
    work.mkdir(parents=True, exist_ok=True)
    ordered = [sources['section1'], sources['section2'], sources['section3'], sources['section4']]
    normalized = []
    content = timing['section_content_durations']
    gaps = timing['section_gap_after']
    for idx, src in enumerate(ordered):
        dst = work / f'{idx+1:02d}_dynamic_section.mp4'
        c_dur = float(content[idx])
        gap = float(gaps[idx]) if idx < 3 else 0.0
        total = c_dur + gap
        src_dur = ffprobe_duration(src)
        # When extending a section beyond its native clip length, do NOT clone
        # the true final frame blindly: some section renderers fade/hide text at
        # the very end, so freezing the true final frame makes the text vanish
        # while VO continues. Instead freeze the last stable text-visible frame
        # shortly before the source ends (usually ~4.75s in a 5s section).
        freeze_before_end = 0.75
        if total > src_dur and abs(src_dur - c_dur) <= 0.12:
            # Source was rendered to the calculated content duration with text
            # held until end, so clone the true last frame only for the gap.
            freeze_at = src_dur
        else:
            freeze_at = min(total, max(0.1, src_dur - freeze_before_end)) if total > src_dur else total
        # Trim section animation to the required content duration, or to the
        # stable freeze frame when extension is needed. Then clone that frame for
        # the rest of the VO/gap duration.
        vf = (
            f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps={fps},"
            f"trim=duration={freeze_at:.3f},setpts=PTS-STARTPTS,"
            f"tpad=stop_mode=clone:stop_duration={max(0.0, total - freeze_at) + 0.05:.3f},"
            f"trim=duration={total:.3f},setpts=PTS-STARTPTS"
        )
        subprocess.run([
            'ffmpeg', '-y', '-i', str(src), '-vf', vf, '-an', '-c:v', 'libx264',
            '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', str(dst),
        ], check=True, timeout=300)
        normalized.append(dst)
    concat_file = work / 'concat_list.txt'
    concat_file.write_text(''.join(f"file '{p.resolve()}'\n" for p in normalized))
    out = out_dir / f'traitdna_n8n_dynamic_{label}.mp4'
    subprocess.run(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', str(concat_file), '-c', 'copy', str(out)], check=True, timeout=300)
    return out


def render_sectioned_voice_mix(config: dict, voice: dict, music_track: dict, section_audios: list[Path], timing: dict, output_dir: Path, label: str, base_video: Path) -> Path:
    rv = load_wan_module()
    music = rv.resolve_master_path(music_track['path'])
    output_dir.mkdir(parents=True, exist_ok=True)
    safe_name = voice['name'].lower().replace(' ', '_')
    out = output_dir / f"traitdna_rotating_voice_{int(voice['number']):02d}_{safe_name}_{label}.mp4"
    duration = float(timing['final_duration'])
    music_start = float(config.get('music_source_start_seconds', 1.0))
    # Keep BG music clearly under the VO for sectioned mixes.
    music_volume = float(config.get('music_volume', 0.32)) * 0.60
    loud = config.get('voice_loudnorm', {})
    loud_i = float(loud.get('I', -16))
    loud_tp = float(loud.get('TP', -1.5))
    loud_lra = float(loud.get('LRA', 11))
    post_volume = float(loud.get('post_volume', 1.05))
    starts = [float(x) for x in timing.get('section_starts', [])]
    if len(starts) != len(section_audios):
        raise ValueError(f'section starts/audio mismatch: {len(starts)} starts for {len(section_audios)} audio clips')

    # Permanent, inspectable timing fix: materialize ONE sequential VO WAV on
    # disk before mixing. Avoid delayed parallel tracks entirely; the final mix
    # only has [voice_track.wav] + [music], so four section VOs cannot overlap at
    # t=0 due to ffmpeg delay/timestamp quirks or Drive preview behavior.
    work = output_dir / f'.voice_track_{label}'
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True, exist_ok=True)
    pieces = []
    cursor = 0.0
    for i, (audio, start) in enumerate(zip(section_audios, starts), start=1):
        if start > cursor + 0.005:
            gap_path = work / f'gap_before_{i:02d}.wav'
            subprocess.run([
                'ffmpeg', '-y', '-f', 'lavfi', '-i', f'anullsrc=r=48000:cl=stereo',
                '-t', f'{start - cursor:.3f}', '-c:a', 'pcm_s16le', str(gap_path)
            ], check=True, timeout=60)
            pieces.append(gap_path)
            cursor = start
        norm_path = work / f'vo_{i:02d}.wav'
        subprocess.run([
            'ffmpeg', '-y', '-i', str(audio),
            '-af', f'atrim=0:{duration:.3f},asetpts=PTS-STARTPTS,loudnorm=I={loud_i}:TP={loud_tp}:LRA={loud_lra},volume={post_volume},aresample=48000,aformat=channel_layouts=stereo',
            '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', str(norm_path)
        ], check=True, timeout=120)
        pieces.append(norm_path)
        cursor = start + ffprobe_duration(norm_path)
    if duration > cursor + 0.005:
        tail_path = work / 'tail_silence.wav'
        subprocess.run([
            'ffmpeg', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
            '-t', f'{duration - cursor:.3f}', '-c:a', 'pcm_s16le', str(tail_path)
        ], check=True, timeout=60)
        pieces.append(tail_path)

    concat_file = work / 'voice_concat.txt'
    concat_file.write_text(''.join(f"file '{p.resolve()}'\n" for p in pieces))
    voice_track = work / 'voice_track.wav'
    subprocess.run([
        'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', str(concat_file),
        '-t', f'{duration:.3f}', '-c:a', 'pcm_s16le', str(voice_track)
    ], check=True, timeout=120)

    filter_complex = (
        f"[1:a]atrim=0:{duration:.3f},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[voice];"
        f"[2:a]atrim=0:{duration:.3f},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume={music_volume}[music];"
        f"[voice][music]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95,atrim=0:{duration:.3f}[aout]"
    )
    cmd = ['ffmpeg', '-y', '-i', str(base_video), '-i', str(voice_track), '-ss', str(music_start), '-i', str(music), '-filter_complex', filter_complex, '-map', '0:v:0', '-map', '[aout]', '-t', f'{duration:.3f}', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-movflags', '+faststart', str(out)]
    subprocess.run(cmd, check=True, timeout=300)
    return out


def add_voiceover_to_video(base_video: Path, row: dict, label: str, hook: str, insight: str, implication: str, cta: str, cta_sub: str):
    rv = load_wan_module()
    cfg = load_json(VOICE_CONFIG)
    state = load_json(VOICE_STATE) if VOICE_STATE.exists() else {
        'rotation_name': cfg.get('rotation_name'),
        'next_voice_number': 1,
        'next_music_number': 1,
        'total_videos_created_with_rotation': 0,
        'history': [],
    }
    total_voices = len(cfg.get('voices') or [])
    total_music = len(rv.discover_music_tracks(cfg))
    voice = rv.voice_for_number(cfg, int(state.get('next_voice_number', 1)))
    music = rv.music_for_number(cfg, int(state.get('next_music_number', 1)))
    vo_text = compose_voiceover_text(row, hook, insight, implication, cta, cta_sub)
    audio = rv.generate_replicate_voiceover(cfg, voice, vo_text, label)
    out = rv.render(cfg, voice, music, audio, ROTATING_OUTPUT_DIR, label, base_video_override=base_video)

    state['last_used_voice_number'] = voice['number']
    state['last_used_voice_name'] = voice['name']
    state['last_used_music_number'] = music['number']
    state['last_used_music_name'] = music.get('name') or Path(music['path']).name
    state['last_used_music_path'] = music['path']
    state['last_generated_audio'] = str(audio)
    state['last_output'] = str(out)
    state['last_contextual_base_video'] = str(base_video)
    state['next_voice_number'] = rv.next_number_after(voice['number'], total_voices)
    state['next_music_number'] = rv.next_number_after(music['number'], total_music)
    state['total_videos_created_with_rotation'] = int(state.get('total_videos_created_with_rotation', 0)) + 1
    state.setdefault('history', []).append({
        'created_at': datetime.now(timezone.utc).isoformat(),
        'voice_number': voice['number'],
        'voice_name': voice['name'],
        'music_number': music['number'],
        'music_name': state['last_used_music_name'],
        'music_path': music['path'],
        'contextual_base_video': str(base_video),
        'generated_audio': str(audio),
        'output': str(out),
        'row_label': label,
    })
    write_json(VOICE_STATE, state)
    return out, {
        'voice_number': voice['number'],
        'voice_name': voice['name'],
        'music_number': music['number'],
        'music_name': state['last_used_music_name'],
        'generated_audio': str(audio),
        'voiceover_text': vo_text,
        'next_voice_number': state['next_voice_number'],
    }


def add_sectioned_voiceover_to_video(base_video: Path, row: dict, label: str, hook: str, insight: str, implication: str, cta: str, cta_sub: str, timing: dict):
    rv = load_wan_module()
    cfg = load_json(VOICE_CONFIG)
    state = load_json(VOICE_STATE) if VOICE_STATE.exists() else {
        'rotation_name': cfg.get('rotation_name'),
        'next_voice_number': 1,
        'next_music_number': 1,
        'total_videos_created_with_rotation': 0,
        'history': [],
    }
    total_voices = len(cfg.get('voices') or [])
    total_music = len(rv.discover_music_tracks(cfg))
    voice = rv.voice_for_number(cfg, int(state.get('next_voice_number', 1)))
    music = rv.music_for_number(cfg, int(state.get('next_music_number', 1)))

    # Important: do not speed-fit the section clips. We set a very high fit
    # limit so render_with_rotating_voice copies the raw generated audio as-is.
    gen_cfg = deepcopy(cfg)
    gen_cfg.setdefault('voiceover_generation', {})['fit_to_seconds'] = 999.0
    section_texts = [
        normalize_voice_text(hook),
        normalize_voice_text(insight),
        normalize_voice_text(implication),
        normalize_voice_text(cta),
    ]
    section_names = ['hook', 'insight', 'implication', 'cta']
    section_audios = []
    audio_meta = []
    for idx, (name, text) in enumerate(zip(section_names, section_texts), start=1):
        audio = rv.generate_replicate_voiceover(gen_cfg, voice, text, f'{label}_section{idx}_{name}')
        section_audios.append(audio)
        meta_path = audio.with_suffix('.json')
        meta = load_json(meta_path) if meta_path.exists() else {}
        audio_meta.append({
            'section': idx,
            'name': name,
            'text': text,
            'audio': str(audio),
            'duration': ffprobe_duration(audio),
            'generation_meta': meta,
        })

    out = render_sectioned_voice_mix(cfg, voice, music, section_audios, timing, ROTATING_OUTPUT_DIR, label, base_video)

    state['last_used_voice_number'] = voice['number']
    state['last_used_voice_name'] = voice['name']
    state['last_used_music_number'] = music['number']
    state['last_used_music_name'] = music.get('name') or Path(music['path']).name
    state['last_used_music_path'] = music['path']
    state['last_generated_audio'] = [str(x) for x in section_audios]
    state['last_output'] = str(out)
    state['last_contextual_base_video'] = str(base_video)
    state['next_voice_number'] = rv.next_number_after(voice['number'], total_voices)
    state['next_music_number'] = rv.next_number_after(music['number'], total_music)
    state['total_videos_created_with_rotation'] = int(state.get('total_videos_created_with_rotation', 0)) + 1
    state.setdefault('history', []).append({
        'created_at': datetime.now(timezone.utc).isoformat(),
        'voice_number': voice['number'],
        'voice_name': voice['name'],
        'music_number': music['number'],
        'music_name': state['last_used_music_name'],
        'music_path': music['path'],
        'contextual_base_video': str(base_video),
        'generated_audio': [str(x) for x in section_audios],
        'output': str(out),
        'row_label': label,
        'timing': timing,
    })
    state['history'] = state.get('history', [])[-100:]
    write_json(VOICE_STATE, state)
    return out, {
        'voice_number': voice['number'],
        'voice_name': voice['name'],
        'music_number': music['number'],
        'music_name': state['last_used_music_name'],
        'generated_audio': [str(x) for x in section_audios],
        'sections': audio_meta,
        'timing': timing,
        'voiceover_text': ' '.join(section_texts),
        'next_voice_number': state['next_voice_number'],
    }


def section2_has_stat(insight: str) -> bool:
    """Use normal Section 2 only when Insight_Text contains ~95 / 95%."""
    text = ' '.join(str(insight or '').split())
    return bool(re.search(r'~?\s*95\s*%', text))


def parse_section2(insight: str):
    text = ' '.join(str(insight or '').split())
    m = re.search(r'(\d{1,3})\s*%', text)
    stat = int(m.group(1)) if m else 95
    if m:
        # The sheet often starts Insight_Text like “Most of the ~95% of ...”.
        # Section 2 already shows the large percentage, so remove everything
        # through the percent and keep only the readable body sentence.
        body = text[m.end():]
        body = re.sub(r'^\s*of\s+', '', body, flags=re.I)
    else:
        body = text
    body = body or "U.S. publicly posted jobs stay invisible to candidates who don't know to search them"
    # Section 2 card has tight horizontal margins; keep each body line shorter
    # so long final lines do not overflow the rounded card edges.
    return stat, wrap_lines(body, max_lines=7, max_chars=15)


def parse_section2_5(insight: str):
    # Section 2.5 is for non-stat insight rows. Keep the full Insight_Text,
    # but wrap it more conservatively than the first draft so the text stays
    # inside the rounded card and does not touch/bleed past the margins.
    text = ' '.join(str(insight or '').split())
    return wrap_lines(text, max_lines=7, max_chars=19)


def render_one(row: dict, index: int, drive_folder_id: str):
    stamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    label = safe_label(row.get('label') or row.get('row_id') or row.get('id') or f'n8n_bulk_{stamp}_{index:03d}')
    label = f'{label}_{stamp}_{index:03d}'
    wan_mod = load_wan_module()
    wcfg = wan_config()
    wan_dir = MASTER / 'assets' / 'wan_contextual_clips'
    wan_dir.mkdir(parents=True, exist_ok=True)

    hook = row.get('Hook_Text') or row.get('hook_text') or 'Most Software Developers qualify for more job titles than they apply to.'
    insight = row.get('Insight_Text') or row.get('insight_text') or "95% of U.S. publicly posted jobs stay invisible to candidates who don't know to search them"
    implication = row.get('Implication_Text') or row.get('implication_text') or "Your strongest matches may be roles you've never searched."
    cta = row.get('CTA_Text') or row.get('cta_text') or 'Start with your TraitDNA™ Work-Style Report free, 15 minutes.'
    cta_sub = row.get('CTA Sub Text') or row.get('cta_sub_text') or 'Free. 15 minutes. No credit card. Get your personal Work-Style Report.'

    # Generate natural section VO first so visual section durations can be
    # calculated before rendering text/video. Voice speed is not changed.
    rv = load_wan_module()
    cfg_for_voice = load_json(VOICE_CONFIG)
    state_for_voice = load_json(VOICE_STATE) if VOICE_STATE.exists() else {'next_voice_number': 1, 'next_music_number': 1, 'history': []}
    selected_voice = rv.voice_for_number(cfg_for_voice, int(state_for_voice.get('next_voice_number', 1)))
    nofit_cfg = deepcopy(cfg_for_voice)
    nofit_cfg.setdefault('voiceover_generation', {})['fit_to_seconds'] = 999.0
    temp_section_texts = [normalize_voice_text(hook), normalize_voice_text(insight), normalize_voice_text(implication), normalize_voice_text(cta)]
    temp_section_names = ['hook', 'insight', 'implication', 'cta']
    temp_audios = []
    for idx, (name, text) in enumerate(zip(temp_section_names, temp_section_texts), start=1):
        temp_audios.append(rv.generate_replicate_voiceover(nofit_cfg, selected_voice, text, f'{label}_section{idx}_{name}'))
    vo_durations = [ffprobe_duration(p) for p in temp_audios]
    timing = dynamic_section_timing(vo_durations, fps=30)
    timing['section_audio_paths'] = [str(p) for p in temp_audios]
    timing['section_texts'] = temp_section_texts
    section_content = timing['section_content_durations']

    # Section 1
    s1_root = PROJECT / 'section1'
    s1 = load_json(s1_root / 'config' / 'section1_config.json')
    s1['headline_text'] = hook
    s1['duration_seconds'] = section_content[0]
    s1['hold_text_until_end'] = True
    s1['slow_video_to_duration'] = True
    s1['text_reveal_steps'] = reveal_steps_from_text(hook)
    s1_wan = wan_dir / f'{label}_section1_wan.mp4'
    wan_mod.generate_replicate_wan_clip(wcfg, 'section1', hook, s1_wan, label)
    s1['clip_path'] = str(s1_wan)
    s1['audio_path'] = None
    s1['output_name'] = f'section1_n8n_{label}.mp4'
    s1_cfg = s1_root / 'config' / f'.n8n_{label}.json'
    write_json(s1_cfg, s1)
    subprocess.run(['python3', str(s1_root / 'scripts' / 'render_section1.py'), str(s1_cfg)], check=True, cwd=str(s1_root), capture_output=True, text=True, timeout=180)

    # Section 2 / Section 2.5
    s2_root = PROJECT / 'section2'
    if section2_has_stat(insight):
        s2 = load_json(s2_root / 'config' / 'section2_editable_match.json')
        stat, body_lines = parse_section2(insight)
        s2['stat_value'] = stat
        s2['stat_suffix'] = '%'
        s2['body_lines'] = body_lines
        s2['duration_seconds'] = section_content[1]
        s2['variant'] = 'section2_stat_95'
        s2['output_name'] = f'section2_n8n_{label}.mp4'
        s2_cfg = s2_root / 'config' / f'.n8n_{label}.json'
        write_json(s2_cfg, s2)
        subprocess.run(['python3', str(s2_root / 'scripts' / 'render_section2_editable_match.py'), str(s2_cfg)], check=True, cwd=str(s2_root), capture_output=True, text=True, timeout=240)
    else:
        s2 = load_json(s2_root / 'config' / 'section2_5_text_only.json')
        s2['body_lines'] = parse_section2_5(insight)
        s2['duration_seconds'] = section_content[1]
        s2['variant'] = 'section2_5_text_only_no_stat'
        s2['output_name'] = f'section2_5_n8n_{label}.mp4'
        s2_cfg = s2_root / 'config' / f'.n8n_section2_5_{label}.json'
        write_json(s2_cfg, s2)
        subprocess.run(['python3', str(s2_root / 'scripts' / 'render_section2_5_text_only.py'), str(s2_cfg)], check=True, cwd=str(s2_root), capture_output=True, text=True, timeout=240)

    # Section 3
    s3_root = PROJECT / 'section3'
    s3 = load_json(s3_root / 'config' / 'section3_config.json')
    s3['text_lines'] = wrap_lines(implication, max_lines=4, max_chars=16) or s3.get('text_lines', [])
    s3['duration_seconds'] = section_content[2]
    s3['hold_text_until_end'] = True
    s3['slow_video_to_duration'] = True
    s3_wan = wan_dir / f'{label}_section3_wan.mp4'
    wan_mod.generate_replicate_wan_clip(wcfg, 'section3', implication, s3_wan, label)
    s3['clip_path'] = str(s3_wan)
    s3['audio_path'] = None
    s3['output_name'] = f'section3_n8n_{label}.mp4'
    s3_cfg = s3_root / 'config' / f'.n8n_{label}.json'
    write_json(s3_cfg, s3)
    subprocess.run(['python3', str(s3_root / 'scripts' / 'render_section3.py'), str(s3_cfg)], check=True, cwd=str(s3_root), capture_output=True, text=True, timeout=180)

    # Section 4
    s4_root = PROJECT / 'section4'
    s4 = load_json(s4_root / 'config' / 'section4_config.json')
    s4['main_text'] = wrap_lines(cta, max_lines=3, max_chars=26) or s4.get('main_text', [])
    s4['small_text'] = wrap_lines(cta_sub, max_lines=2, max_chars=40) or s4.get('small_text', [])
    s4['duration_seconds'] = section_content[3]
    s4['output_name'] = f'section4_n8n_{label}.mp4'
    s4_cfg = s4_root / 'config' / f'.n8n_{label}.json'
    write_json(s4_cfg, s4)
    subprocess.run(['python3', str(s4_root / 'scripts' / 'render_section4.py'), str(s4_cfg)], check=True, cwd=str(s4_root), capture_output=True, text=True, timeout=180)

    sources = {
        'section1': s1_root / 'output' / s1['output_name'],
        'section2': s2_root / 'output' / s2['output_name'],
        'section3': s3_root / 'output' / s3['output_name'],
        'section4': s4_root / 'output' / s4['output_name'],
    }
    # Assemble sections with the already-calculated dynamic timing. Section 1/3
    # were rendered directly to their content durations with slowed B-roll and
    # text held to the section end; this step only adds any inter-section gaps.
    silent_out = render_dynamic_full_video(sources, label, timing, fps=30)

    # Reuse the already-generated section audios for the final mix without
    # generating duplicates; keep state/metadata handling equivalent to
    # add_sectioned_voiceover_to_video.
    cfg = cfg_for_voice
    state = state_for_voice
    total_voices = len(cfg.get('voices') or [])
    total_music = len(rv.discover_music_tracks(cfg))
    voice = selected_voice
    music = rv.music_for_number(cfg, int(state.get('next_music_number', 1)))
    out = render_sectioned_voice_mix(cfg, voice, music, temp_audios, timing, ROTATING_OUTPUT_DIR, label, silent_out)
    audio_meta = []
    for idx, (name, text, audio) in enumerate(zip(temp_section_names, temp_section_texts, temp_audios), start=1):
        meta_path = audio.with_suffix('.json')
        audio_meta.append({
            'section': idx,
            'name': name,
            'text': text,
            'audio': str(audio),
            'duration': ffprobe_duration(audio),
            'generation_meta': load_json(meta_path) if meta_path.exists() else {},
        })
    state['last_used_voice_number'] = voice['number']
    state['last_used_voice_name'] = voice['name']
    state['last_used_music_number'] = music['number']
    state['last_used_music_name'] = music.get('name') or Path(music['path']).name
    state['last_used_music_path'] = music['path']
    state['last_generated_audio'] = [str(x) for x in temp_audios]
    state['last_output'] = str(out)
    state['last_contextual_base_video'] = str(silent_out)
    state['next_voice_number'] = rv.next_number_after(voice['number'], total_voices)
    state['next_music_number'] = rv.next_number_after(music['number'], total_music)
    state['total_videos_created_with_rotation'] = int(state.get('total_videos_created_with_rotation', 0)) + 1
    state.setdefault('history', []).append({
        'created_at': datetime.now(timezone.utc).isoformat(),
        'voice_number': voice['number'],
        'voice_name': voice['name'],
        'music_number': music['number'],
        'music_name': state['last_used_music_name'],
        'music_path': music['path'],
        'contextual_base_video': str(silent_out),
        'generated_audio': [str(x) for x in temp_audios],
        'output': str(out),
        'row_label': label,
        'timing': timing,
    })
    state['history'] = state.get('history', [])[-100:]
    write_json(VOICE_STATE, state)
    voice_meta = {
        'voice_number': voice['number'],
        'voice_name': voice['name'],
        'music_number': music['number'],
        'music_name': state['last_used_music_name'],
        'generated_audio': [str(x) for x in temp_audios],
        'sections': audio_meta,
        'timing': timing,
        'voiceover_text': ' '.join(temp_section_texts),
        'next_voice_number': state['next_voice_number'],
    }

    # Verify final voiced output
    verify = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate', '-of', 'json', str(out)], text=True, timeout=30)
    verify_json = json.loads(verify)
    (out.with_suffix(out.suffix + '.verify.json')).write_text(json.dumps(verify_json, indent=2) + '\n')

    # Upload + share
    upload_json = subprocess.check_output(['gog', 'drive', 'upload', str(out), '--parent', drive_folder_id, '--json', '--no-input'], text=True, timeout=300)
    upload = json.loads(upload_json)
    file_obj = upload.get('file') or upload.get('result') or upload
    file_id = file_obj['id']
    share_json = subprocess.check_output(['gog', 'drive', 'share', file_id, '--to', 'anyone', '--role', 'reader', '--json', '--no-input', '--force'], text=True, timeout=120)
    share = json.loads(share_json)
    link = share.get('link') or file_obj.get('webViewLink') or f'https://drive.google.com/file/d/{file_id}/view?usp=drivesdk'

    return {
        'ok': True,
        'row_index': index,
        'label': label,
        'video_path': str(out),
        'silent_video_path': str(silent_out),
        'voice': voice_meta,
        'drive_file_id': file_id,
        'drive_link': link,
        'file_name': file_obj.get('name'),
        'size': file_obj.get('size'),
        'verify': verify_json,
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        return

    def do_GET(self):
        if urlparse(self.path).path == '/health':
            self._send(200, {'ok': True, 'service': 'ai-video-n8n-bridge'})
        else:
            self._send(404, {'ok': False, 'error': 'not_found'})

    def do_POST(self):
        if urlparse(self.path).path != '/ai-video-render-bulk':
            self._send(404, {'ok': False, 'error': 'not_found'})
            return
        try:
            length = int(self.headers.get('Content-Length') or 0)
            payload = json.loads(self.rfile.read(length).decode('utf-8') or '{}') if length else {}
            rows = payload.get('rows')
            if rows is None:
                rows = [payload.get('row') or payload]
            if not isinstance(rows, list):
                rows = [rows]
            rows = [r if isinstance(r, dict) else {'Hook_Text': str(r)} for r in rows]
            limit = max(1, min(int(payload.get('limit') or len(rows) or 1), 20))
            rows = rows[:limit]
            drive_folder_id = payload.get('drive_folder_id') or DEFAULT_DRIVE_FOLDER
            results = []
            for i, row in enumerate(rows, start=1):
                try:
                    results.append(render_one(row, i, drive_folder_id))
                except Exception as e:
                    results.append({'ok': False, 'row_index': i, 'error': str(e)})
                    if not payload.get('continue_on_error', True):
                        break
            self._send(200, {'ok': all(r.get('ok') for r in results), 'count': len(results), 'results': results})
        except Exception as e:
            self._send(500, {'ok': False, 'error': str(e)})


if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 8013), Handler).serve_forever()
