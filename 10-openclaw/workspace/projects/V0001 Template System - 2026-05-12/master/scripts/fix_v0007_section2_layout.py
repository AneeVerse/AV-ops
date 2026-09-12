#!/usr/bin/env python3
from __future__ import annotations
import importlib.util, json, shlex, subprocess
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE = Path('/root/.openclaw/workspace')
PROJECT = WORKSPACE / 'projects' / 'V0001 Template System - 2026-05-12'
MASTER = PROJECT / 'master'
BASE_SCRIPT = MASTER / 'scripts' / 'render_batch_v0006_v0015.py'
PREV_SUMMARY = MASTER / 'output' / 'Remade_V0007_V0010_section4_once_no_text_20260702_132814' / 'SUMMARY.json'

spec = importlib.util.spec_from_file_location('batch', BASE_SCRIPT)
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)

run_id = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
label = f'V0007_section2_fixed_{run_id}'
batch.RUN_ID = run_id
batch.OUTDIR = MASTER / 'output' / f'Fixed_V0007_section2_layout_{run_id}'
batch.OUTDIR.mkdir(parents=True, exist_ok=True)

def run(cmd):
    cmd = [str(x) for x in cmd]
    print('+', ' '.join(shlex.quote(x) for x in cmd), flush=True)
    subprocess.run(cmd, check=True)

def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

def main():
    prev = json.loads(PREV_SUMMARY.read_text())['videos']['V0007']
    durations = [float(x) for x in prev['section_durations']]
    starts = [int(x) for x in prev['starts_ms']]
    old_label = prev['old_label']

    # Re-render only Section 2 with cleaner manual lines.
    s2_root = PROJECT / 'section2'
    s2_cfg = batch.load_json(s2_root / 'config' / 'section2_5_text_only.json')
    s2_cfg['duration_seconds'] = durations[1]
    s2_cfg['body_lines'] = [
        'Most applicants',
        'self-limit to their',
        'current title.',
        'Hiring doesn\'t.',
        'The pay gap between',
        'titles is wider than',
        'most candidates realize.'
    ]
    s2_cfg['body_max_chars'] = 21
    s2_cfg['body_max_lines'] = 7
    s2_cfg['body_font_size'] = 70
    s2_cfg['body_leading'] = 100
    s2_cfg['preserve_body_lines'] = True
    s2_cfg['safe_text_width'] = 840
    s2_cfg['output_name'] = f'section2_5_fixed_{label}.mp4'
    cfg_path = s2_root / 'config' / f'.section2_5_fixed_{label}.json'
    write_json(cfg_path, s2_cfg)
    run(['python3', s2_root / 'scripts' / 'render_section2_5_text_only.py', cfg_path])

    # Reuse approved sections 1, 3, and corrected section 4 from the previous batch.
    sources = {
        'section1': PROJECT / 'section1' / 'output' / f'section1_n8n_{old_label}.mp4',
        'section2': s2_root / 'output' / s2_cfg['output_name'],
        'section3': PROJECT / 'section3' / 'output' / f'section3_n8n_{old_label}.mp4',
        'section4': PROJECT / 'section4' / 'output' / f'section4_once_no_text_new_bg_V0007_section4_once_20260702_132814.mp4',
    }
    audios = [Path(x) for x in json.loads(PREV_SUMMARY.read_text())['videos']['V0007'].get('audios', [])]
    # The previous summary omitted audios in compact form; fall back to known original audio paths.
    if not audios:
        original = json.loads((MASTER / 'output' / 'Regenerated_V0007_V0008_V0001_visual_prompt_20260701_081503' / 'SUMMARY.json').read_text())['videos']['V0007']
        audios = [Path(x) for x in original['audios'][:3]] + [MASTER / 'audio' / 'rotating_voice_generated' / 'voice_02_hope_V0007_section4_once_20260702_132814_section4_cta_fitted.mp3']
    for p in list(sources.values()) + audios:
        if not p.exists(): raise FileNotFoundError(p)

    silent = batch.render_silent(label, sources, durations)
    final = batch.mix_audio('V0007', label, silent, audios, starts)
    verify = batch.ffprobe(final)

    qc = batch.OUTDIR / 'qc'; qc.mkdir(exist_ok=True)
    for ms in [starts[1], starts[1]+1500, starts[1]+3500, starts[3], starts[3]+1700]:
        run(['ffmpeg','-y','-ss',f'{ms/1000:.3f}','-i',final,'-frames:v','1',qc/f'V0007_{ms}ms.jpg'])
    drive = batch.upload(final, 'V0007.mp4')
    summary = {
        'run_id': run_id,
        'changes': {
            'section2_issue': 'fixed awkward visual line break: “Hiring doesn’t and…”',
            'section2_new_lines': s2_cfg['body_lines'],
            'section4': 'unchanged from corrected version: background once only, no text'
        },
        'videos': {'V0007': {'label': label, 'section_durations': durations, 'starts_ms': starts, 'final': str(final), 'verify': verify, 'drive': drive}}
    }
    write_json(batch.OUTDIR / 'SUMMARY.json', summary)
    print(json.dumps(summary, indent=2, ensure_ascii=False))

if __name__ == '__main__': main()
