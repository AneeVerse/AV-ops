#!/usr/bin/env python3
from __future__ import annotations
import importlib.util, json, shlex, subprocess
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE = Path('/root/.openclaw/workspace')
PROJECT = WORKSPACE / 'projects' / 'V0001 Template System - 2026-05-12'
MASTER = PROJECT / 'master'
BASE_SCRIPT = MASTER / 'scripts' / 'render_batch_v0006_v0015.py'
FRESH_SUMMARY = MASTER / 'output' / 'Regenerated_V0010_fresh_V0001_visual_prompt_20260702_142248' / 'SUMMARY.json'
BG = PROJECT / 'section4' / 'assets' / 'section4_bg_1nNdVHN1ceDKpFAFX-r9Dkp0kpwigq-I8.mp4'
NEW_SECTION4_VO = 'Free Trait D-N-A report - tap the profile link.'

spec = importlib.util.spec_from_file_location('batch', BASE_SCRIPT)
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)

run_id = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
batch.RUN_ID = run_id
batch.OUTDIR = MASTER / 'output' / f'Fixed_V0010_fresh_section4_once_no_text_{run_id}'
batch.OUTDIR.mkdir(parents=True, exist_ok=True)

def run(cmd):
    cmd = [str(x) for x in cmd]
    print('+', ' '.join(shlex.quote(x) for x in cmd), flush=True)
    subprocess.run(cmd, check=True)

def cap(cmd):
    return subprocess.check_output([str(x) for x in cmd], text=True)

def duration(path: Path) -> float:
    return float(cap(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',path]).strip())

def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

def normalize(src: Path, out: Path, dur: float, mode='pad'):
    src_d = duration(src)
    if mode == 'slow' and src_d > 0:
        vf = f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setpts=PTS*{dur/src_d:.8f},trim=duration={dur:.6f},setpts=PTS-STARTPTS"
        inputs = ['-i', src]
    else:
        vf = f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,tpad=stop_mode=clone:stop_duration={dur:.6f},trim=duration={dur:.6f},setpts=PTS-STARTPTS"
        inputs = ['-i', src]
    run(['ffmpeg','-y',*inputs,'-t',f'{dur:.6f}','-vf',vf,'-an','-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',out])

def concat_sections(section_paths, out: Path):
    concat = out.with_suffix('.concat.txt')
    concat.write_text(''.join(f"file '{p.resolve()}'\n" for p in section_paths))
    video_only = out.with_name(out.stem + '_video_only.mp4')
    run(['ffmpeg','-y','-f','concat','-safe','0','-i',concat,'-c','copy',video_only])
    run(['ffmpeg','-y','-i',video_only,'-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000','-t','20','-shortest','-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','128k','-movflags','+faststart',out])
    return out

def main():
    fresh = json.loads(FRESH_SUMMARY.read_text())['videos']['V0010']
    old_label = fresh['label']
    label = f'V0010_fresh_section4_once_{run_id}'
    sources = {
        'section1': PROJECT/'section1'/'output'/f'section1_n8n_{old_label}.mp4',
        'section2': PROJECT/'section2'/'output'/f'section2_5_n8n_{old_label}.mp4',
        'section3': PROJECT/'section3'/'output'/f'section3_n8n_{old_label}.mp4',
    }
    for k,p in sources.items():
        if not p.exists():
            raise FileNotFoundError(f'missing {k}: {p}')
    old = [float(x) for x in fresh['section_durations']]
    s4 = 3.433333
    remaining = 20.0 - s4 - old[0]
    old23 = old[1] + old[2]
    s2 = remaining * old[1] / old23
    s3 = remaining - s2
    durations = [round(old[0],6), round(s2,6), round(s3,6), s4]
    starts = [0, int(round(durations[0]*1000)), int(round((durations[0]+durations[1])*1000)), int(round((durations[0]+durations[1]+durations[2])*1000))]

    rv = batch.load_wan_module(); vcfg = batch.load_json(batch.VOICE_CONFIG)
    voice = {'number': fresh['voice']['number'], 'name': fresh['voice']['name']}
    audios = [Path(x) for x in fresh['audios'][:3]]
    a4 = batch.generate_section_audio(rv, vcfg, voice, NEW_SECTION4_VO, label, 'section4_cta')
    audios.append(a4)

    s4_src = PROJECT/'section4'/'output'/f'section4_once_no_text_new_bg_{label}.mp4'
    run(['ffmpeg','-y','-i',BG,'-t',f'{durations[3]:.6f}','-vf',f'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,trim=duration={durations[3]:.6f},setpts=PTS-STARTPTS','-an','-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',s4_src])

    work = batch.OUTDIR/'normalized'/'V0010'; work.mkdir(parents=True, exist_ok=True)
    n1,n2,n3,n4 = [work/f'{i}_{name}.mp4' for i,name in enumerate(['s1','s2','s3','s4'],1)]
    normalize(sources['section1'], n1, durations[0], mode='pad')
    normalize(sources['section2'], n2, durations[1], mode='pad')
    normalize(sources['section3'], n3, durations[2], mode='slow')
    normalize(s4_src, n4, durations[3], mode='pad')

    silent = MASTER/'output'/f'traitdna_silent_{label}.mp4'
    concat_sections([n1,n2,n3,n4], silent)
    final = batch.mix_audio('V0010', label, silent, audios, starts)
    verify = batch.ffprobe(final)
    qc = batch.OUTDIR/'qc'; qc.mkdir(exist_ok=True)
    for ms in [1000, starts[1]+500, starts[2]+500, starts[3]+300, starts[3]+1700, 19500]:
        run(['ffmpeg','-y','-ss',f'{ms/1000:.3f}','-i',final,'-frames:v','1',qc/f'V0010_{ms}ms.jpg'])
    drive = batch.upload(final, 'V0010.mp4')
    summary = {
        'run_id': run_id,
        'changes': {
            'fresh_sections_1_3_from': str(FRESH_SUMMARY),
            'section4_behavior': 'approved replacement background once only, no loop/repeat, no on-screen text',
            'section4_voiceover': NEW_SECTION4_VO,
            'discarded_prior_upload': fresh.get('drive', {}).get('link'),
        },
        'videos': {'V0010': {'label': label, 'source_label': old_label, 'voice': fresh['voice'], 'section_durations': durations, 'starts_ms': starts, 'audios': [str(x) for x in audios], 'final': str(final), 'verify': verify, 'drive': drive}}
    }
    write_json(batch.OUTDIR/'SUMMARY.json', summary)
    print(json.dumps(summary, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
