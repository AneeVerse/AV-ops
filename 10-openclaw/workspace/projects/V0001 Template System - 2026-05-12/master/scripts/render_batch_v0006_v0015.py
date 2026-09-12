#!/usr/bin/env python3
from __future__ import annotations
import json, math, os, re, shlex, subprocess, sys, importlib.util
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE = Path('/root/.openclaw/workspace')
PROJECT = WORKSPACE / 'projects' / 'V0001 Template System - 2026-05-12'
MASTER = PROJECT / 'master'
SHEET_ID = '1MMslDeXLGBKG6tjPao1_pRIGzaRTOlubwn5UJssB8xE'
SHEET_RANGE = '300_Video_Master_Attribution!A1:BZ200'
DRIVE_FOLDER_ID = '1ICdGOWUiR3905Vuef-pqbXJ0fvg8paND'
RUN_ID = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
OUTDIR = MASTER / 'output' / f'Final_Batch_V0006_V0015_{RUN_ID}'
OUTDIR.mkdir(parents=True, exist_ok=True)
VOICE_CONFIG = MASTER / 'config' / 'voice_rotation_config.json'
RENDER_WITH_ROTATING = MASTER / 'scripts' / 'render_with_rotating_voice.py'
WAN_DIR = MASTER / 'assets' / 'wan_contextual_clips'
WAN_DIR.mkdir(parents=True, exist_ok=True)
MUSIC = (MASTER / '../../AE_reference_import_2026-05-12/extracted/V0001 folder/(Footage)/music/Corporate.wav').resolve()

# Approved reusable Section 4 template from the fixed V0010 render:
# - replacement background only
# - shown once, no loop/repeat
# - no added CTA / subtext overlay from the renderer
# - fixed CTA VO, with CTA Sub Text excluded from voiceover
APPROVED_SECTION4_BG = PROJECT / 'section4' / 'assets' / 'section4_bg_1nNdVHN1ceDKpFAFX-r9Dkp0kpwigq-I8.mp4'
APPROVED_SECTION4_VO = 'Free Trait D-N-A report - tap the profile link.'
APPROVED_SECTION4_MAX_VO_SECONDS = 3.3

TARGET_IDS = os.environ.get('TARGET_IDS')
if TARGET_IDS:
    TARGET_IDS = [x.strip() for x in TARGET_IDS.split(',') if x.strip()]
else:
    TARGET_IDS = [f'V{i:04d}' for i in range(11,16)]


def run(cmd, **kw):
    cmd=[str(x) for x in cmd]
    print('+', ' '.join(shlex.quote(x) for x in cmd), flush=True)
    return subprocess.run(cmd, check=True, **kw)

def cap(cmd, **kw):
    cmd=[str(x) for x in cmd]
    print('+', ' '.join(shlex.quote(x) for x in cmd), flush=True)
    return subprocess.check_output(cmd, text=True, **kw)

def load_json(path: Path): return json.loads(path.read_text())
def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False)+'\n')

def ffprobe(path: Path) -> dict:
    return json.loads(cap(['ffprobe','-v','error','-show_entries','format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate,sample_rate,channels','-of','json',path]))

def duration(path: Path) -> float:
    return float(cap(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',path]).strip())

def load_wan_module():
    spec=importlib.util.spec_from_file_location('render_with_rotating_voice', RENDER_WITH_ROTATING)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def wan_config():
    cfg=load_json(VOICE_CONFIG)
    vg=cfg.setdefault('contextual_video_generation', {})
    vg['enabled']=True
    vg['model']='kwaivgi/kling-v2.6'
    vg['generate_audio']=False
    # Based on the approved V0011_20260702_051822 developer/code-screen prompt.
    # Keep this close to the older wording: that generation produced the desired
    # side/rear developer profile with laptop/monitor/code ambience.
    vg['negative_prompt']='text, subtitles, logo, Apple logo, app icons, visible laptop screen, readable screen, UI overlay, chart, graph, branding, brand marks, cartoon, animation, CGI, hologram, distorted face, distorted hands, extra fingers, fast camera movement, shaky camera, low quality, front-facing corporate employee, suit, boardroom, conference room'
    vg.setdefault('prompt_templates', {})
    common="""Create a NEW unique realistic 5-second vertical 9:16 professional B-roll video. Do not reuse any prior clip.

Script placeholder/context only:
{USER_TEXT}

Use the script placeholder only for mood and action relevance. Do NOT show, write, caption, subtitle, or render any words from it.

Scene: a software developer at a modern workstation/home-office engineering desk, clearly a developer in the first second. Include laptop or external monitor, keyboard/mouse, casual developer clothing, headphones or tech desk cues, IDE/terminal/code-editor ambience as soft blurred screen glow only.

Camera/composition: back-side, side-angle, 3/4 rear, or over-the-shoulder view; never front-facing. Smooth slow push-in or subtle side movement. Wide medium shot with person/desk/devices in the lower half. Keep the top 25-30% clean empty negative space for template text overlay.

Screens: face the subject, not the camera. Show monitor back/edge or angled blurred IDE/terminal glow only. No readable text, code, UI labels, charts, documents, logos, app icons, Apple logo, brand marks, or branding.

Style/mood: realistic cinematic professional B-roll, warm natural light, shallow depth of field, polished career-tech feel, focused optimistic developer.

Avoid: suits, boardrooms, meetings, generic corporate stock footage, front-facing smiles, readable screens, app icons, Apple logo, visible brand marks, on-screen text generated in the footage, logos, cartoons, CGI, holograms, distorted hands/faces, fast or shaky camera, low quality."""
    vg['prompt_templates']['section1']=common
    vg['prompt_templates']['section3']=common
    return cfg

def safe_label(s: str) -> str:
    return re.sub(r'[^A-Za-z0-9_.-]+','_',s).strip('_')[:100]

def norm(s): return ' '.join(str(s or '').split())

def wrap_text(text, max_chars=18, max_lines=5):
    text=norm(text)
    if not text: return []
    words=text.split(); lines=[]; cur=[]
    for w in words:
        test=' '.join(cur+[w])
        if not cur or len(test) <= max_chars:
            cur.append(w)
        else:
            lines.append(' '.join(cur)); cur=[w]
            if len(lines)>=max_lines-1: break
    used=sum(len(x.split()) for x in lines)
    rest=words[used:]
    if rest: lines.append(' '.join(rest))
    return lines[:max_lines]

def reveal_steps(text):
    lines=wrap_text(text,18,5) or ['Most Software','Developers','qualify for more','job titles than','they apply to.']
    starts=[0.0,0.2,0.42,0.68,1.0]; ends=[0.2,0.42,0.68,1.0,4.86]
    return [{'start':starts[min(i,4)], 'end':ends[min(i,4)], 'text':'\n'.join(lines[:i+1])} for i in range(len(lines))]

def has_95(text: str) -> bool:
    return re.search(r'~?\s*95\s*%', text or '') is not None

def parse_section2(insight: str):
    text=norm(insight)
    m=re.search(r'(?:~\s*)?(\d{1,3})\s*%', text)
    stat=int(m.group(1)) if m else 95
    body=text[m.end():] if m else text
    # Keep the full insight visible on-screen. Do not remove “Across the ~95%”
    # even though the stat is also shown large; user explicitly wants whole text.
    body=text
    return stat, wrap_text(body, 22, 8)

def avoid_bad_line_breaks(lines):
    """Avoid visual lines like “Hiring doesn't and” or lines ending in weak conjunctions.

    This is display-only wrapping; it prevents awkward Section 2.5 cards in future
    batches without changing the source Sheet text.
    """
    weak = {'and', 'or', 'but', 'to', 'of', 'for', 'with'}
    out=[]
    for line in lines:
        words=line.split()
        if out and words and out[-1].split()[-1].lower().strip('.,;:—-') in weak:
            moved=out[-1].split()
            w=moved.pop()
            out[-1]=' '.join(moved)
            words=[w]+words
        if words and words[-1].lower().strip('.,;:—-') in weak and len(words)>1:
            # keep the conjunction with the following idea instead of orphaning it visually
            out.append(' '.join(words[:-1]))
            out.append(words[-1])
        else:
            out.append(' '.join(words))
    return [x for x in out if x]

def clean_section25_display_text(text: str) -> str:
    text = norm(text)
    # Prevent the known bad visual read: “Hiring doesn't and ...”
    text = re.sub(r"\bHiring doesn't\s+and\s+the pay gap\b", "Hiring doesn't. The pay gap", text, flags=re.I)
    return text

def section25_lines(insight: str):
    return avoid_bad_line_breaks(wrap_text(clean_section25_display_text(insight), 19, 7))

def row_value(row, *names):
    for n in names:
        if n in row and str(row[n]).strip(): return str(row[n]).strip()
    return ''

def fetch_rows():
    raw=cap(['gog','sheets','get',SHEET_ID,SHEET_RANGE,'--json','--no-input'])
    data=json.loads(raw); vals=data.get('values') or []
    headers=vals[0]
    rows=[]
    for v in vals[1:]:
        d={h: (v[i] if i < len(v) else '') for i,h in enumerate(headers)}
        if d.get('Video_ID') in TARGET_IDS: rows.append(d)
    if [r.get('Video_ID') for r in rows] != TARGET_IDS:
        raise RuntimeError(f'Missing/ordered rows wrong: {[r.get("Video_ID") for r in rows]}')
    write_json(OUTDIR/'sheet_rows.json', rows)
    return rows

def voice_for_video(video_id: str, cfg: dict, rv):
    n=int(video_id[1:])
    voice_number=(n+4)%10 + 1  # keeps V0003=8, V0004=9, V0005=10, V0006=1
    return rv.voice_for_number(cfg, voice_number)

def clean_vo_text(text: str):
    text=norm(text).replace('~','approximately ').replace('™','').replace('—',', ')
    text=text.replace('TraitDNA','Trait DNA')
    return norm(text)

def generate_section_audio(rv, cfg, voice, text, label, section_name):
    # generate_replicate_voiceover expects one label, so include section suffix
    return rv.generate_replicate_voiceover(cfg, voice, clean_vo_text(text), f'{label}_{section_name}')


def atempo_filter(factor: float) -> str:
    parts=[]
    while factor > 2.0:
        parts.append('atempo=2.0'); factor /= 2.0
    while factor < 0.5:
        parts.append('atempo=0.5'); factor /= 0.5
    parts.append(f'atempo={factor:.6f}')
    return ','.join(parts)

def fit_audio_if_needed(path: Path, max_duration: float, label: str, section_name: str) -> Path:
    d=duration(path)
    if d <= max_duration:
        return path
    factor=d/max_duration
    out=path.with_name(path.stem + f'_max{max_duration:.1f}s.mp3')
    run(['ffmpeg','-y','-i',path,'-filter:a',atempo_filter(factor),'-vn','-ar','44100','-ac','1','-b:a','128k',out])
    print(f'Audio fit {label} {section_name}: {d:.3f}s -> {duration(out):.3f}s speed={factor:.3f}', flush=True)
    return out

def allocate_timing(audio_durations):
    # Natural VO, no speed-up. Give each section enough visual time, add gaps, then trim slack to exactly 20s.
    min_content=[4.2,3.2,3.2,3.0]
    pads=[0.45,0.38,0.42,0.38]
    contents=[]
    for d,m,p in zip(audio_durations,min_content,pads):
        val=max(m, d+p)
        val=math.ceil(val*30)/30
        contents.append(val)
    gaps=[0.5,0.5,0.5]
    total=sum(contents)+sum(gaps)
    if total>20:
        over=total-20
        # reduce gaps first down to 0.1 each
        for i in range(3):
            cut=min(over, gaps[i]-0.1)
            gaps[i]-=cut; over-=cut
            if over<=1e-6: break
        # then reduce content only to audio duration + 0.05, from longest slack
        while over>1e-6:
            slacks=[contents[i]-(audio_durations[i]+0.05) for i in range(4)]
            j=max(range(4), key=lambda i: slacks[i])
            if slacks[j]<=0: break
            cut=min(over, slacks[j], 1/30)
            contents[j]-=cut; over-=cut
        if over>0.05:
            raise RuntimeError(f'Cannot fit section audios into 20s: audio={audio_durations}, total={total}, over={over}')
    elif total<20:
        contents[-1]+=20-total
    # snap to ms for audio start delays
    starts=[0]
    t=contents[0]+gaps[0]
    starts.append(t)
    t+=contents[1]+gaps[1]
    starts.append(t)
    t+=contents[2]+gaps[2]
    starts.append(t)
    return contents, gaps, [int(round(x*1000)) for x in starts]

def render_sections(row, label, durations, variant):
    rv=load_wan_module(); wcfg=wan_config()
    vid=row['Video_ID']
    hook=row_value(row,'Hook_Text')
    insight=row_value(row,'Insight_Text')
    implication=row_value(row,'Implication_Text')
    cta=row_value(row,'CTA_Text')
    cta_sub=row_value(row,'CTA Sub Text ','CTA Sub Text','CTA_Sub_Text') or 'Free. No card. See your real options in 15 to 20 minutes.'
    sources={}
    # Section 1
    s1_root=PROJECT/'section1'; s1=load_json(s1_root/'config/section1_config.json')
    s1['duration_seconds']=durations[0]
    s1['headline_text']=hook; s1['text_reveal_steps']=reveal_steps(hook)
    # safer for long hooks
    if len(wrap_text(hook,18,5)) >= 5:
        s1['font_size']=112; s1['line_gap']=134; s1['position_y_start']=135; s1['position_y_end']=105
        s1['line_reveal_starts']=[0.12,0.25,0.40,0.57,0.76]
    s1_wan=WAN_DIR/f'{label}_section1_wan.mp4'
    rv.generate_replicate_wan_clip(wcfg,'section1',hook,s1_wan,label)
    s1['clip_path']=str(s1_wan); s1['audio_path']=None; s1['output_name']=f'section1_n8n_{label}.mp4'
    s1_cfg=s1_root/'config'/f'.n8n_{label}.json'; write_json(s1_cfg,s1)
    run(['python3',s1_root/'scripts/render_section1.py',s1_cfg])
    sources['section1']=s1_root/'output'/s1['output_name']
    # Section 2 or 2.5
    s2_root=PROJECT/'section2'
    if variant=='section2':
        s2=load_json(s2_root/'config/section2_editable_match.json')
        stat, body=parse_section2(insight)
        s2['duration_seconds']=durations[1]
        s2['stat_value']=stat; s2['stat_suffix']='%'; s2['stat_prefix']='~' if '~' in insight else s2.get('stat_prefix','~')
        s2['body_lines']=body; s2['output_name']=f'section2_n8n_{label}.mp4'
        if len(' '.join(body)) > 90 or len(body) > 5:
            # Long Insight text needs full copy + safe margins. Use smaller text and
            # more lines so nothing is truncated and side padding stays clean.
            s2['body_max_chars']=22
            s2['body_max_lines']=8
            s2['body_font_size']=64
            s2['body_line_gap']=76
            s2['body_start_y']=890
            s2['line_starts']=[0.16,0.22,0.30,0.40,0.52,0.66,0.82,1.00]
        s2_cfg=s2_root/'config'/f'.n8n_{label}.json'; write_json(s2_cfg,s2)
        run(['python3',s2_root/'scripts/render_section2_editable_match.py',s2_cfg])
        sources['section2']=s2_root/'output'/s2['output_name']
    else:
        s25=load_json(s2_root/'config/section2_5_text_only.json')
        s25['duration_seconds']=durations[1]
        s25['body_lines']=section25_lines(insight)
        s25['output_name']=f'section2_5_n8n_{label}.mp4'
        s25['variant']='section2_5_text_only_no_stat'
        s25_cfg=s2_root/'config'/f'.n8n_section2_5_{label}.json'; write_json(s25_cfg,s25)
        run(['python3',s2_root/'scripts/render_section2_5_text_only.py',s25_cfg])
        sources['section2']=s2_root/'output'/s25['output_name']
    # Section 3
    s3_root=PROJECT/'section3'; s3=load_json(s3_root/'config/section3_config.json')
    s3['duration_seconds']=durations[2]; s3['font_size']=132
    s3['text_lines']=wrap_text(implication,16,4) or s3.get('text_lines',[])
    s3_wan=WAN_DIR/f'{label}_section3_wan.mp4'
    rv.generate_replicate_wan_clip(wcfg,'section3',implication,s3_wan,label)
    s3['clip_path']=str(s3_wan); s3['audio_path']=None; s3['output_name']=f'section3_n8n_{label}.mp4'; s3['hold_text_until_end']=True; s3['slow_video_to_duration']=True
    s3_cfg=s3_root/'config'/f'.n8n_{label}.json'; write_json(s3_cfg,s3)
    run(['python3',s3_root/'scripts/render_section3.py',s3_cfg])
    sources['section3']=s3_root/'output'/s3['output_name']
    # Section 4: use the approved V0010 fixed template permanently.
    # Do NOT render the old Section 4 text/subtext layout here; that was the mismatch.
    # The approved behavior is the replacement background once only, with no added overlay text.
    s4_root=PROJECT/'section4'
    s4_out=s4_root/'output'/f'section4_once_no_text_new_bg_{label}.mp4'
    run([
        'ffmpeg','-y','-i',APPROVED_SECTION4_BG,'-t',f'{durations[3]:.6f}',
        '-vf',f'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,trim=duration={durations[3]:.6f},setpts=PTS-STARTPTS',
        '-an','-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',s4_out
    ])
    sources['section4']=s4_out
    return sources

def render_silent(label, sources, durations):
    cfg={'project_id':f'traitdna_{label}','size':'1080x1920','fps':30,'section_duration_seconds':5,'total_duration_seconds':20,'audio_mode':'silent_placeholder','output_name':f'traitdna_silent_{label}.mp4','sections':[]}
    for sid,key,dur in [('section1_hook','section1',durations[0]),('section2_insight','section2',durations[1]),('section3_implication','section3',durations[2]),('section4_cta','section4',durations[3])]:
        cfg['sections'].append({'id':sid,'source':str(sources[key]),'duration_seconds':dur})
    cfg_path=MASTER/'config'/f'.batch_full_{label}.json'; write_json(cfg_path,cfg)
    run(['python3',MASTER/'scripts/render_full_video.py',cfg_path])
    return MASTER/'output'/cfg['output_name']

def mix_audio(video_id, label, silent, audios, starts_ms):
    out=OUTDIR/f'{video_id}.mp4'
    cmd=['ffmpeg','-y','-i',silent]
    for a in audios: cmd+=['-i',a]
    cmd+=['-ss','1.0','-i',MUSIC]
    filters=['anullsrc=channel_layout=stereo:sample_rate=48000,atrim=0:20[base]']; labels=[]
    for i,delay in enumerate(starts_ms, start=1):
        filters.append(f'[{i}:a]asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=11,volume=1.05,adelay={delay}:all=1[v{i}]')
        labels.append(f'[v{i}]')
    filters.append('[5:a]asetpts=PTS-STARTPTS,atrim=0:20,volume=0.30720[music]')
    fc=';'.join(filters)+';'+'[base]'+''.join(labels)+'[music]amix=inputs=6:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95,atrim=0:20[aout]'
    cmd+=['-filter_complex',fc,'-map','0:v:0','-map','[aout]','-t','20','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',out]
    run(cmd)
    return out

def upload(path: Path, name: str):
    raw=cap(['gog','drive','upload',path,'--parent',DRIVE_FOLDER_ID,'--name',name,'--json','--no-input'])
    obj=json.loads(raw).get('file') or json.loads(raw).get('result') or json.loads(raw)
    fid=obj['id']
    cap(['gog','drive','share',fid,'--to','anyone','--role','reader','--json','--no-input','--force'])
    return {'id':fid,'link':obj.get('webViewLink') or f'https://drive.google.com/file/d/{fid}/view?usp=drivesdk','name':obj.get('name'),'size':obj.get('size')}

def main():
    rows=fetch_rows(); rv=load_wan_module(); vcfg=load_json(VOICE_CONFIG)
    summary={'run_id':RUN_ID,'drive_folder_id':DRIVE_FOLDER_ID,'videos':{},'section2_routing':{}}
    for row in rows:
        vid=row['Video_ID']; label=f'{vid}_{RUN_ID}'
        hook=row_value(row,'Hook_Text'); insight=row_value(row,'Insight_Text'); implication=row_value(row,'Implication_Text')
        # Section 4 VO is fixed to the approved V0010 CTA. CTA Sub Text stays excluded from VO.
        cta=APPROVED_SECTION4_VO
        variant='section2' if has_95(insight) else 'section2_5'
        summary['section2_routing'][vid]=variant
        voice=voice_for_video(vid, vcfg, rv)
        texts=[hook, insight, implication, cta]
        audios=[]; adurs=[]
        for sec,text in zip(['section1_hook','section2_insight','section3_implication','section4_cta'],texts):
            a=generate_section_audio(rv, vcfg, voice, text, label, sec)
            # Keep generated VO at its natural speed. Fit by changing visual section
            # durations / frame holds only; do not use atempo on voiceover.
            audios.append(a); adurs.append(duration(a))
        durations,gaps,starts_ms=allocate_timing(adurs)
        sources=render_sections(row,label,durations,variant)
        silent=render_silent(label,sources,durations)
        final=mix_audio(vid,label,silent,audios,starts_ms)
        verify=ffprobe(final)
        # QC frames at starts
        qc=OUTDIR/'qc'; qc.mkdir(exist_ok=True)
        for ms in starts_ms:
            run(['ffmpeg','-y','-ss',f'{ms/1000:.3f}','-i',final,'-frames:v','1',qc/f'{vid}_{ms}ms.jpg'])
        drive=upload(final,f'{vid}.mp4')
        summary['videos'][vid]={'label':label,'variant':variant,'voice':{'number':voice['number'],'name':voice['name']},'section_audio_durations':adurs,'section_durations':durations,'gaps':gaps,'starts_ms':starts_ms,'audios':[str(a) for a in audios],'silent':str(silent),'final':str(final),'verify':verify,'drive':drive}
        write_json(OUTDIR/'SUMMARY.json',summary)
    print(json.dumps(summary,indent=2,ensure_ascii=False))

if __name__=='__main__': main()
