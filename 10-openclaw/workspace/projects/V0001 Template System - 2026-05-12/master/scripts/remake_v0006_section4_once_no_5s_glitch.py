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
label = f'V0006_no_5s_glitch_{run_id}'
batch.RUN_ID = run_id
batch.OUTDIR = MASTER / 'output' / f'Remade_V0006_section4_once_no_5s_glitch_{run_id}'
batch.OUTDIR.mkdir(parents=True, exist_ok=True)

def run(cmd):
    cmd = [str(x) for x in cmd]
    print('+', ' '.join(shlex.quote(x) for x in cmd), flush=True)
    subprocess.run(cmd, check=True)

def cap(cmd):
    return subprocess.check_output([str(x) for x in cmd], text=True)

def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

def duration(path: Path) -> float:
    return float(cap(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',path]).strip())

def normalize(src: Path, out: Path, dur: float, mode='pad'):
    # mode=slow stretches the source evenly instead of freeze-padding. Use only for moving/video sections.
    src_d = duration(src)
    if mode == 'slow':
        vf = f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setpts=PTS*{dur/src_d:.8f},trim=duration={dur:.6f},setpts=PTS-STARTPTS"
    else:
        vf = f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,tpad=stop_mode=clone:stop_duration={dur:.6f},trim=duration={dur:.6f},setpts=PTS-STARTPTS"
    run(['ffmpeg','-y','-i',src,'-t',f'{dur:.6f}','-vf',vf,'-an','-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',out])


def concat_sections(section_paths, out: Path):
    concat = batch.OUTDIR / 'concat_list.txt'
    concat.write_text(''.join(f"file '{p.resolve()}'\n" for p in section_paths))
    video_only = batch.OUTDIR / 'combined_video_only.mp4'
    run(['ffmpeg','-y','-f','concat','-safe','0','-i',concat,'-c','copy',video_only])
    run(['ffmpeg','-y','-i',video_only,'-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000','-t','20','-shortest','-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','128k','-movflags','+faststart',out])
    return out


def main():
    prev = json.loads(PREV_SUMMARY.read_text())['videos']['V0006']
    # Keep section 1 natural length to avoid visible hold/glitch at 5-6s. Section 4 is once only.
    durations = [4.633333, 6.0, 5.933334, 3.433333]
    starts_ms = [0, 4633, 10633, 16567]
    audios = [Path(x) for x in prev['audios'][:3]]

    rv = batch.load_wan_module()
    vcfg = batch.load_json(batch.VOICE_CONFIG)
    voice = {'number': 1, 'name': 'Juniper'}
    a4 = batch.generate_section_audio(rv, vcfg, voice, NEW_SECTION4_VO, label, 'section4_cta')
    audios.append(a4)

    s1_src = PROJECT / 'section1' / 'output' / 'section1_n8n_V0006_20260701_071533.mp4'
    s2_src = PROJECT / 'section2' / 'output' / 'section2_5_n8n_V0006_20260701_071533.mp4'
    s3_src = PROJECT / 'section3' / 'output' / 'section3_n8n_V0006_20260701_071533.mp4'
    s4_src = PROJECT / 'section4' / 'output' / f'section4_once_no_text_new_bg_{label}.mp4'
    run(['ffmpeg','-y','-i',BG,'-t',f'{durations[3]:.6f}','-vf',f'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,trim=duration={durations[3]:.6f},setpts=PTS-STARTPTS','-an','-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',s4_src])

    work = batch.OUTDIR / 'normalized'; work.mkdir(exist_ok=True)
    n1, n2, n3, n4 = [work / f'{i}_{name}.mp4' for i,name in enumerate(['s1','s2','s3','s4'],1)]
    normalize(s1_src, n1, durations[0], mode='pad')
    normalize(s2_src, n2, durations[1], mode='pad')
    normalize(s3_src, n3, durations[2], mode='slow')
    normalize(s4_src, n4, durations[3], mode='pad')

    silent = MASTER / 'output' / f'traitdna_silent_{label}.mp4'
    concat_sections([n1,n2,n3,n4], silent)
    final = batch.mix_audio('V0006', label, silent, audios, starts_ms)
    verify = batch.ffprobe(final)

    qc = batch.OUTDIR / 'qc'; qc.mkdir(exist_ok=True)
    for ms in [4500,5000,5500,6000,starts_ms[3],starts_ms[3]+1700]:
        run(['ffmpeg','-y','-ss',f'{ms/1000:.3f}','-i',final,'-frames:v','1',qc/f'V0006_{ms}ms.jpg'])

    drive = batch.upload(final, 'V0006.mp4')
    summary = {
        'run_id': run_id,
        'changes': {
            'reason': 'avoid 5-6s visual glitch/hold by keeping section 1 at natural timing',
            'section4_behavior': 'shown once only; no loop/repeat; no text',
            'section4_voiceover': NEW_SECTION4_VO,
            'section_durations': durations,
            'audio_starts_ms': starts_ms
        },
        'videos': {'V0006': {'label': label, 'section_durations': durations, 'starts_ms': starts_ms, 'final': str(final), 'verify': verify, 'drive': drive}}
    }
    write_json(batch.OUTDIR / 'SUMMARY.json', summary)
    print(json.dumps(summary, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
