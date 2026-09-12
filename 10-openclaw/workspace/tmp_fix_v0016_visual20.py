#!/usr/bin/env python3
import json, subprocess, shlex
from pathlib import Path

WORKSPACE=Path('/root/.openclaw/workspace')
PROJECT=WORKSPACE/'projects'/'V0001 Template System - 2026-05-12'
MASTER=PROJECT/'master'
RUN_ID='20260705_074808'
VID='V0016'
LABEL=f'{VID}_{RUN_ID}'
OUTDIR=MASTER/'output'/f'Final_Batch_V0006_V0015_{RUN_ID}'
MUSIC=(MASTER/'../../AE_reference_import_2026-05-12/extracted/V0001 folder/(Footage)/music/Corporate.wav').resolve()

def run(cmd):
    cmd=[str(x) for x in cmd]
    print('+',' '.join(shlex.quote(x) for x in cmd), flush=True)
    subprocess.run(cmd,check=True)

def write_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,indent=2)+'\n')

summary=json.loads((OUTDIR/'SUMMARY.json').read_text())
info=summary['videos'][VID]
durs=info['section_durations']
gaps=info['gaps']
visual_durs=[durs[0]+gaps[0], durs[1]+gaps[1], durs[2]+gaps[2], durs[3]]
assert abs(sum(visual_durs)-20)<1e-6, visual_durs
sources={
 'section1': PROJECT/'section1'/'output'/f'section1_n8n_{LABEL}.mp4',
 'section2': PROJECT/'section2'/'output'/f'section2_5_n8n_{LABEL}.mp4',
 'section3': PROJECT/'section3'/'output'/f'section3_n8n_{LABEL}.mp4',
 'section4': PROJECT/'section4'/'output'/f'section4_once_no_text_new_bg_{LABEL}.mp4',
}
cfg={'project_id':f'traitdna_{LABEL}_visual20','size':'1080x1920','fps':30,'section_duration_seconds':5,'total_duration_seconds':20,'audio_mode':'silent_placeholder','output_name':f'traitdna_silent_{LABEL}_visual20.mp4','sections':[]}
for sid,key,dur in [('section1_hook','section1',visual_durs[0]),('section2_insight','section2',visual_durs[1]),('section3_implication','section3',visual_durs[2]),('section4_cta','section4',visual_durs[3])]:
    cfg['sections'].append({'id':sid,'source':str(sources[key]),'duration_seconds':dur})
cfg_path=MASTER/'config'/f'.batch_full_{LABEL}_visual20.json'
write_json(cfg_path,cfg)
run(['python3',MASTER/'scripts/render_full_video.py',cfg_path])
silent=MASTER/'output'/cfg['output_name']
out=OUTDIR/f'{VID}_visual20.mp4'
audios=info['audios']
starts_ms=info['starts_ms']
cmd=['ffmpeg','-y','-i',silent]
for a in audios: cmd += ['-i',a]
cmd += ['-ss','1.0','-i',MUSIC]
filters=['anullsrc=channel_layout=stereo:sample_rate=48000,atrim=0:20[base]']; labels=[]
for i,delay in enumerate(starts_ms,start=1):
    filters.append(f'[{i}:a]asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=11,volume=1.05,adelay={delay}:all=1[v{i}]')
    labels.append(f'[v{i}]')
filters.append('[5:a]asetpts=PTS-STARTPTS,atrim=0:20,volume=0.30720[music]')
fc=';'.join(filters)+';'+'[base]'+''.join(labels)+'[music]amix=inputs=6:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95,atrim=0:20[aout]'
cmd += ['-filter_complex',fc,'-map','0:v:0','-map','[aout]','-t','20','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',out]
run(cmd)
# overwrite canonical local file too after successful render
run(['cp',out,OUTDIR/f'{VID}.mp4'])
print(out)
