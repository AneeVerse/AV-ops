#!/usr/bin/env python3
from __future__ import annotations
import importlib.util, json, shlex, subprocess
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE = Path('/root/.openclaw/workspace')
PROJECT = WORKSPACE / 'projects' / 'V0001 Template System - 2026-05-12'
MASTER = PROJECT / 'master'
BASE_SCRIPT = MASTER / 'scripts' / 'render_batch_v0006_v0015.py'
BG = PROJECT / 'section4' / 'assets' / 'section4_bg_1nNdVHN1ceDKpFAFX-r9Dkp0kpwigq-I8.mp4'
PREV_SUMMARY = MASTER / 'output' / 'Regenerated_V0006_V0001_visual_prompt_20260701_071533' / 'SUMMARY.json'
NEW_SECTION4_VO = 'Free Trait D-N-A report - tap the profile link.'

spec = importlib.util.spec_from_file_location('batch', BASE_SCRIPT)
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)

run_id = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
label = f'V0006_section4_update_{run_id}'
batch.RUN_ID = run_id
batch.OUTDIR = MASTER / 'output' / f'Remade_V0006_section4_bg_no_text_new_vo_{run_id}'
batch.OUTDIR.mkdir(parents=True, exist_ok=True)

def run(cmd):
    cmd = [str(x) for x in cmd]
    print('+', ' '.join(shlex.quote(x) for x in cmd), flush=True)
    subprocess.run(cmd, check=True)

def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

def main():
    prev = json.loads(PREV_SUMMARY.read_text())['videos']['V0006']
    durations = prev['section_durations']
    starts_ms = prev['starts_ms']
    audios = [Path(x) for x in prev['audios'][:3]]

    rv = batch.load_wan_module()
    vcfg = batch.load_json(batch.VOICE_CONFIG)
    voice = {'number': 1, 'name': 'Juniper'}
    a4 = batch.generate_section_audio(rv, vcfg, voice, NEW_SECTION4_VO, label, 'section4_cta')
    audios.append(a4)

    # Render section 4 with the new background only. No CTA box, no text overlay.
    s4_out = PROJECT / 'section4' / 'output' / f'section4_no_text_new_bg_{label}.mp4'
    dur = durations[3]
    run([
        'ffmpeg','-y','-stream_loop','-1','-i',BG,'-t',f'{dur:.6f}',
        '-vf','scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,trim=duration=' + f'{dur:.6f}' + ',setpts=PTS-STARTPTS',
        '-an','-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',s4_out
    ])

    sources = {
        'section1': PROJECT / 'section1' / 'output' / 'section1_n8n_V0006_20260701_071533.mp4',
        'section2': PROJECT / 'section2' / 'output' / 'section2_5_n8n_V0006_20260701_071533.mp4',
        'section3': PROJECT / 'section3' / 'output' / 'section3_n8n_V0006_20260701_071533.mp4',
        'section4': s4_out,
    }
    silent = batch.render_silent(label, sources, durations)
    final = batch.mix_audio('V0006', label, silent, audios, starts_ms)
    verify = batch.ffprobe(final)

    # QC frames: start of every section + mid section4.
    qc = batch.OUTDIR / 'qc'; qc.mkdir(exist_ok=True)
    for ms in starts_ms + [starts_ms[3] + 2500]:
        run(['ffmpeg','-y','-ss',f'{ms/1000:.3f}','-i',final,'-frames:v','1',qc/f'V0006_{ms}ms.jpg'])

    drive = batch.upload(final, 'V0006.mp4')
    summary = {
        'run_id': run_id,
        'changes': {
            'section4_background': str(BG),
            'section4_on_screen_text': 'removed',
            'section4_voiceover': NEW_SECTION4_VO,
            'sections_1_to_3_source': 'reused from Regenerated_V0006_V0001_visual_prompt_20260701_071533'
        },
        'videos': {
            'V0006': {
                'label': label,
                'section_durations': durations,
                'starts_ms': starts_ms,
                'audios': [str(a) for a in audios],
                'section4_source': str(s4_out),
                'silent': str(silent),
                'final': str(final),
                'verify': verify,
                'drive': drive,
            }
        }
    }
    write_json(batch.OUTDIR / 'SUMMARY.json', summary)
    print(json.dumps(summary, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
