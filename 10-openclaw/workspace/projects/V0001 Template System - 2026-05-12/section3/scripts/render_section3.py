#!/usr/bin/env python3
import json, pathlib, subprocess, sys, shlex
ROOT=pathlib.Path(__file__).resolve().parents[1]
config_path=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'config'/'section3_config.json'
if not config_path.is_absolute(): config_path=(ROOT/config_path).resolve()
c=json.loads(config_path.read_text())
def rel(p):
    p=pathlib.Path(p); return p if p.is_absolute() else ROOT/p
def ass_time(s):
    cs=int(round(float(s)*100)); h=cs//360000; cs%=360000; m=cs//6000; cs%=6000; sec=cs//100; cc=cs%100
    return f"{h}:{m:02d}:{sec:02d}.{cc:02d}"
def esc(t): return t.replace('\\','\\\\').replace('{','\\{').replace('}','\\}')
text_dir=ROOT/'text'; out_dir=ROOT/'output'; text_dir.mkdir(exist_ok=True); out_dir.mkdir(exist_ok=True)
ass=text_dir/'section3_generated.ass'
font_dir=rel(c['font_dir'])
lines=['[Script Info]','ScriptType: v4.00+','PlayResX: 1080','PlayResY: 1920','WrapStyle: 0','ScaledBorderAndShadow: yes','[V4+ Styles]',
'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
f"Style: Line,{c['font_family_ass']},{c['font_size']},{c['font_color_ass']},{c['font_color_ass']},{c['shadow_color_ass']},&H00000000,-1,0,0,0,100,100,-1,0,1,0,{c['shadow_size']},8,0,0,0,1",
'[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
for i,line in enumerate(c['text_lines']):
    start=c['reveal_starts'][i]
    y=c['position_y']+i*c['line_gap']
    y0=y+c['slide_px']
    fade_out=0 if c.get('hold_text_until_end', False) else 250
    end_time=float(c['duration_seconds']) + (1.0 if c.get('hold_text_until_end', False) else -0.1)
    tag=f"{{\\fad(150,{fade_out})\\move({c['position_x']},{y0},{c['position_x']},{y},0,{c['reveal_duration_ms']})}}"
    lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end_time)},Line,,0,0,0,,{tag}{esc(line)}")
ass.write_text('\n'.join(lines)+'\n')
clip=rel(c['clip_path']); audio=rel(c['audio_path']) if c.get('audio_path') else None
out=out_dir/c['output_name']; vs=c['video_style']
def probe_duration(path):
    try:
        return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(path)], text=True).strip())
    except Exception:
        return float(c.get('duration_seconds',5))
clip_duration=probe_duration(clip)
render_duration=float(c.get('duration_seconds',5))
setpts=''
if c.get('slow_video_to_duration', False) and render_duration > clip_duration > 0:
    setpts=f",setpts={(render_duration/clip_duration):.8f}*PTS"
base=(f"scale={vs['scale_width']}:{vs['scale_height']}:force_original_aspect_ratio=increase,"
      f"crop={vs['crop_width']}:{vs['crop_height']}:x=(iw-ow)/2:y=(ih-oh)/2,fps={c['fps']},"
      f"eq=contrast={vs['contrast']}:saturation={vs['saturation']}:brightness={vs['brightness']}:gamma={vs['gamma']}"
      f"{setpts}")
# Smooth transparent black gradient, invisible above y=850 and max alpha ~72% at bottom.
grad="format=rgba,geq=r='0':g='0':b='0':a='if(lt(Y,850),0,184*pow((Y-850)/(1920-850),2)*(3-2*((Y-850)/(1920-850))))'"
fc=f"[0:v]{base}[v0];[1:v]{grad}[g];[v0][g]overlay=0:0,subtitles='{ass}':fontsdir='{font_dir}'[v]"
loop_args=[] if c.get('slow_video_to_duration', False) else ['-stream_loop','-1']
cmd=['ffmpeg','-y']+loop_args+['-i',str(clip),'-f','lavfi','-i','color=c=black@0.0:s=1080x1920:r=30']
if audio and audio.exists(): cmd+=['-i',str(audio)]
cmd+=['-t',str(c['duration_seconds']),'-filter_complex',fc,'-map','[v]']
if audio and audio.exists(): cmd+=['-map','2:a']
else: cmd+=['-an']
cmd+=['-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p']
if audio and audio.exists(): cmd+=['-c:a','aac','-b:a','192k']
cmd+=['-movflags','+faststart',str(out)]
print('Running:', ' '.join(shlex.quote(x) for x in cmd))
subprocess.run(cmd, check=True)
print(out)
