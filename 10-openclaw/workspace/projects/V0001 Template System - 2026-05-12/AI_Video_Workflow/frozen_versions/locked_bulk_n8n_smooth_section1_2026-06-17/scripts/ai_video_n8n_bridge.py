#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys
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
    vg['prompt_templates']['section1'] = 'Create a realistic 5-second vertical 9:16 professional B-roll video.\nUser context:\n{USER_TEXT}\nInterpret the text to guide the subject’s profession, mood, setting, and activity. Do not show or write the text.\nStyle: realistic cinematic footage, polished career-tech feel, modern workforce intelligence atmosphere, warm natural light, shallow depth of field, clean professional setting.\nScene: a happy, bright, approachable professional using a laptop in a modern office, coworking space, outdoor café, or workplace environment. The mood should feel optimistic, confident, and professional. Use a serious mood only if the context clearly suggests it. Use a small team only if the context suggests collaboration.\nCamera: smooth slow push-in, slow zoom, or subtle left/right movement. No fast cuts or dramatic motion.\nComposition: frame as a wide medium shot with extra headroom. Position the person, face, hair, laptop, hands, and all meaningful action in the lower half/lower third of the generated video. The top 25-30% of the generated video itself must be clean empty negative space for a text overlay: plain wall, sky, ceiling, or soft blur only. Do not place any face, hair, head, laptop, hands, objects, signs, screens, documents, or busy details in the top 25-30%. Keep the top area visually calm and mostly empty throughout the full 5 seconds.\nLaptop rule: laptop screen must face the subject only. Do not show any screen content to the camera.\nRestrictions: no on-screen text, subtitles, logos, branding, UI overlays, charts, readable documents, cartoons, animation, holograms, or futuristic effects.\nNegative prompt:\ntext, subtitles, logo, visible laptop screen, readable screen, UI overlay, chart, graph, branding, cartoon, animation, CGI, hologram, serious expression unless context requires it, distorted face, distorted hands, extra fingers, fast camera movement, shaky camera, low quality'
    vg['prompt_templates']['section3'] = 'Create a realistic 5-second vertical 9:16 professional B-roll video.\nUser context:\n{USER_TEXT}\nInterpret the text to guide the subject’s profession, mood, setting, and activity. Do not show or write the text.\nStyle: realistic cinematic footage, polished career-tech feel, modern workforce intelligence atmosphere, warm natural light, shallow depth of field, clean professional setting.\nScene: a happy, bright, approachable professional using a laptop in a modern office, coworking space, outdoor café, or workplace environment. The mood should feel optimistic, confident, and professional. Use a serious mood only if the context clearly suggests it. Use a small team only if the context suggests collaboration.\nCamera: smooth slow push-in, slow zoom, or subtle left/right movement. No fast cuts or dramatic motion.\nLaptop rule: laptop screen must face the subject only. Do not show any screen content to the camera.\nRestrictions: no on-screen text, subtitles, logos, branding, UI overlays, charts, readable documents, cartoons, animation, holograms, or futuristic effects.\nNegative prompt:\ntext, subtitles, logo, visible laptop screen, readable screen, UI overlay, chart, graph, branding, cartoon, animation, CGI, hologram, serious expression unless context requires it, distorted face, distorted hands, extra fingers, fast camera movement, shaky camera, low quality'
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
    raw = row.get('Voiceover_Text') or row.get('voiceover_text')
    if raw:
        text = str(raw)
    else:
        text = ' '.join(x for x in [hook, insight, implication, cta, cta_sub] if x)
    text = str(text).replace('~', 'approximately ')
    text = text.replace('™', '').replace('—', ', ')
    text = re.sub(r'\s+', ' ', text).strip()
    text = text.replace('TraitDNA', 'Trait DNA')
    return text


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

    # Section 1
    s1_root = PROJECT / 'section1'
    s1 = load_json(s1_root / 'config' / 'section1_config.json')
    s1['headline_text'] = hook
    s1['text_reveal_steps'] = reveal_steps_from_text(hook)
    s1_wan = wan_dir / f'{label}_section1_wan.mp4'
    wan_mod.generate_replicate_wan_clip(wcfg, 'section1', hook, s1_wan, label)
    s1['clip_path'] = str(s1_wan)
    s1['audio_path'] = None
    s1['output_name'] = f'section1_n8n_{label}.mp4'
    s1_cfg = s1_root / 'config' / f'.n8n_{label}.json'
    write_json(s1_cfg, s1)
    subprocess.run(['python3', str(s1_root / 'scripts' / 'render_section1.py'), str(s1_cfg)], check=True, cwd=str(s1_root), capture_output=True, text=True, timeout=180)

    # Section 2
    s2_root = PROJECT / 'section2'
    s2 = load_json(s2_root / 'config' / 'section2_editable_match.json')
    stat, body_lines = parse_section2(insight)
    s2['stat_value'] = stat
    s2['stat_suffix'] = '%'
    s2['body_lines'] = body_lines
    s2['output_name'] = f'section2_n8n_{label}.mp4'
    s2_cfg = s2_root / 'config' / f'.n8n_{label}.json'
    write_json(s2_cfg, s2)
    subprocess.run(['python3', str(s2_root / 'scripts' / 'render_section2_editable_match.py'), str(s2_cfg)], check=True, cwd=str(s2_root), capture_output=True, text=True, timeout=240)

    # Section 3
    s3_root = PROJECT / 'section3'
    s3 = load_json(s3_root / 'config' / 'section3_config.json')
    s3['text_lines'] = wrap_lines(implication, max_lines=4, max_chars=16) or s3.get('text_lines', [])
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
    s4['output_name'] = f'section4_n8n_{label}.mp4'
    s4_cfg = s4_root / 'config' / f'.n8n_{label}.json'
    write_json(s4_cfg, s4)
    subprocess.run(['python3', str(s4_root / 'scripts' / 'render_section4.py'), str(s4_cfg)], check=True, cwd=str(s4_root), capture_output=True, text=True, timeout=180)

    # Full video
    full = load_json(MASTER / 'config' / 'full_video_config.json')
    full['output_name'] = f'traitdna_n8n_bulk_{label}.mp4'
    sources = {
        'section1': s1_root / 'output' / s1['output_name'],
        'section2': s2_root / 'output' / s2['output_name'],
        'section3': s3_root / 'output' / s3['output_name'],
        'section4': s4_root / 'output' / s4['output_name'],
    }
    for sec in full['sections']:
        if sec['id'].startswith('section1_'):
            sec['source'] = str(sources['section1'])
        elif sec['id'].startswith('section2_'):
            sec['source'] = str(sources['section2'])
        elif sec['id'].startswith('section3_'):
            sec['source'] = str(sources['section3'])
        elif sec['id'].startswith('section4_'):
            sec['source'] = str(sources['section4'])
    full_cfg = MASTER / 'config' / f'.n8n_full_{label}.json'
    write_json(full_cfg, full)
    subprocess.run(['python3', str(MASTER / 'scripts' / 'render_full_video.py'), str(full_cfg)], check=True, cwd=str(MASTER), capture_output=True, text=True, timeout=300)
    silent_out = MASTER / 'output' / full['output_name']

    # Voice-over is now part of the workflow: generate fresh VO with the
    # rotating fixed voice set, mix with music, and upload the voiced video.
    out, voice_meta = add_voiceover_to_video(silent_out, row, label, hook, insight, implication, cta, cta_sub)

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
