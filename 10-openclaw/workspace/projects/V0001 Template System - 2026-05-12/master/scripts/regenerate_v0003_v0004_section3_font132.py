#!/usr/bin/env python3
from __future__ import annotations
import json, pathlib, subprocess, shlex, shutil
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROJECT = ROOT.parent
RUN_ID = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
OUT_DIR = ROOT / 'output' / f'Section3_font132_V0003_V0004_{RUN_ID}'
OUT_DIR.mkdir(parents=True, exist_ok=True)

VIDEOS = {
    'V0003': {
        'label': 'V0003_20260629_135232_001',
        'durations': [5.3, 6.2, 4.1, 4.4],
        'starts_ms': [0, 5300, 11500, 15600],
        'section3_config': PROJECT / 'section3/config/.n8n_V0003_20260629_135232_001.json',
        'sources': [
            '../section1/output/section1_n8n_V0003_20260629_135232_001.mp4',
            '../section2/output/section2_5_n8n_V0003_20260629_135232_001.mp4',
            '../section3/output/section3_n8n_V0003_20260629_135232_001_font132.mp4',
            '../section4/output/section4_n8n_V0003_20260629_135232_001.mp4',
        ],
        'audios': [
            'audio/rotating_voice_generated/voice_08_roger_V0003_20260629_135232_001_section1_hook_fitted.mp3',
            'audio/rotating_voice_generated/voice_08_roger_V0003_20260629_135232_001_section2_insight_fitted.mp3',
            'audio/rotating_voice_generated/voice_08_roger_V0003_20260629_135232_001_section3_implication_fitted.mp3',
            'audio/rotating_voice_generated/voice_08_roger_V0003_20260629_135232_001_section4_cta_fitted.mp3',
        ],
    },
    'V0004': {
        'label': 'V0004_20260629_135807_002',
        'durations': [7.3, 4.166666666666666, 5.1, 3.433333333333333],
        'starts_ms': [0, 7300, 11467, 16567],
        'section3_config': PROJECT / 'section3/config/.n8n_V0004_20260629_135807_002.json',
        'sources': [
            '../section1/output/section1_n8n_V0004_20260629_135807_002.mp4',
            '../section2/output/section2_5_n8n_V0004_20260629_135807_002.mp4',
            '../section3/output/section3_n8n_V0004_20260629_135807_002_font132.mp4',
            '../section4/output/section4_n8n_V0004_20260629_135807_002.mp4',
        ],
        'audios': [
            'audio/rotating_voice_generated/voice_09_james_V0004_20260629_135807_002_section1_hook_fitted.mp3',
            'audio/rotating_voice_generated/voice_09_james_V0004_20260629_135807_002_section2_insight_fitted.mp3',
            'audio/rotating_voice_generated/voice_09_james_V0004_20260629_135807_002_section3_implication_fitted.mp3',
            'audio/rotating_voice_generated/voice_09_james_V0004_20260629_135807_002_section4_cta_fitted.mp3',
        ],
    },
}

MUSIC = ROOT / 'audio/music_rotation/Corporate.wav'
if not MUSIC.exists():
    MUSIC = (ROOT / '../../AE_reference_import_2026-05-12/extracted/V0001 folder/(Footage)/music/Corporate.wav').resolve()


def run(cmd):
    cmd = [str(x) for x in cmd]
    print('+', ' '.join(shlex.quote(x) for x in cmd), flush=True)
    subprocess.run(cmd, check=True)


def probe(path: pathlib.Path) -> dict:
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error',
        '-show_entries', 'format=duration,size,bit_rate:stream=width,height,codec_name,r_frame_rate',
        '-of', 'json', str(path)
    ], text=True))


def render_section3(vkey: str, spec: dict) -> pathlib.Path:
    cfg = json.loads(spec['section3_config'].read_text())
    cfg['font_size'] = 132
    cfg['output_name'] = f"section3_n8n_{spec['label']}_font132.mp4"
    tmp = PROJECT / f"section3/config/.font132_{spec['label']}.json"
    tmp.write_text(json.dumps(cfg, indent=2) + '\n')
    run(['python3', PROJECT / 'section3/scripts/render_section3.py', tmp])
    out = PROJECT / 'section3/output' / cfg['output_name']
    if not out.exists():
        raise FileNotFoundError(out)
    return out


def render_silent_full(vkey: str, spec: dict) -> pathlib.Path:
    cfg = {
        'project_id': f'traitdna_{vkey}_section3_font132',
        'size': '1080x1920',
        'fps': 30,
        'section_duration_seconds': 5,
        'total_duration_seconds': 20,
        'audio_mode': 'silent_placeholder',
        'output_name': f'traitdna_{vkey}_section3_font132_silent_{RUN_ID}.mp4',
        'sections': []
    }
    ids = ['section1_hook', 'section2_insight', 'section3_implication', 'section4_cta']
    for sid, src, dur in zip(ids, spec['sources'], spec['durations']):
        cfg['sections'].append({'id': sid, 'source': src, 'duration_seconds': dur})
    tmp = ROOT / 'config' / f'.font132_full_{vkey}_{RUN_ID}.json'
    tmp.write_text(json.dumps(cfg, indent=2) + '\n')
    run(['python3', ROOT / 'scripts/render_full_video.py', tmp])
    out = ROOT / 'output' / cfg['output_name']
    return out


def remix(vkey: str, spec: dict, silent: pathlib.Path) -> pathlib.Path:
    out = OUT_DIR / f'{vkey}.mp4'
    inputs = ['ffmpeg', '-y', '-i', silent]
    for a in spec['audios']:
        p = ROOT / a
        if not p.exists(): raise FileNotFoundError(p)
        inputs += ['-i', p]
    if not MUSIC.exists(): raise FileNotFoundError(MUSIC)
    inputs += ['-ss', '1.0', '-i', MUSIC]
    voice_filters = []
    labels = []
    for idx, delay in enumerate(spec['starts_ms'], start=1):
        lab = f'a{idx}'
        voice_filters.append(
            f'[{idx}:a]loudnorm=I=-16:TP=-1.5:LRA=11,volume=1.05,adelay={delay}|{delay},apad=pad_dur=20,atrim=0:20[{lab}]'
        )
        labels.append(f'[{lab}]')
    music_input_idx = 5
    voice_filters.append(f'[{music_input_idx}:a]atrim=0:20,volume={0.32*0.96:.5f}[music]')
    fc = ';'.join(voice_filters) + ';' + ''.join(labels) + '[music]amix=inputs=5:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95,atrim=0:20[aout]'
    cmd = inputs + ['-filter_complex', fc, '-map', '0:v:0', '-map', '[aout]', '-t', '20', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]
    run(cmd)
    (out.with_suffix('.ffprobe.json')).write_text(json.dumps(probe(out), indent=2) + '\n')
    return out


def main():
    summary = {'run_id': RUN_ID, 'output_dir': str(OUT_DIR), 'font_change': {'section3_font_size': 132}, 'videos': {}}
    for vkey, spec in VIDEOS.items():
        sec3 = render_section3(vkey, spec)
        silent = render_silent_full(vkey, spec)
        final = remix(vkey, spec, silent)
        summary['videos'][vkey] = {'section3': str(sec3), 'silent': str(silent), 'final': str(final), 'verify': probe(final)}
    (OUT_DIR / 'SUMMARY.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary, indent=2), flush=True)

if __name__ == '__main__':
    main()
