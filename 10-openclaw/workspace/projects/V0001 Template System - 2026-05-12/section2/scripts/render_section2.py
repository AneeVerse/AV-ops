#!/usr/bin/env python3
import json, pathlib, subprocess, sys, shlex
ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parents[0]
config_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT/'config'/'section2_config.json'
if not config_path.is_absolute(): config_path = (ROOT/config_path).resolve()
c=json.loads(config_path.read_text())
out_dir=ROOT/'output'; qc_dir=ROOT/'qc'; out_dir.mkdir(parents=True,exist_ok=True); qc_dir.mkdir(parents=True,exist_ok=True)
text_dir=ROOT/'text'; text_dir.mkdir(parents=True, exist_ok=True)
font_file=(ROOT/pathlib.Path(c['font_file'])).resolve() if not pathlib.Path(c['font_file']).is_absolute() else pathlib.Path(c['font_file'])
font_dir=(ROOT/pathlib.Path(c['font_dir'])).resolve() if not pathlib.Path(c['font_dir']).is_absolute() else pathlib.Path(c['font_dir'])
out=out_dir/c['output_name']
colors=c['colors']; lay=c['layout']; anim=c['animation']; dur=c['duration_seconds']
# Use ASS for body + percent suffix so Graphik font renders correctly.
def ass_time(seconds):
    cs=int(round(float(seconds)*100)); h=cs//360000; cs%=360000; m=cs//6000; cs%=6000; s=cs//100; cc=cs%100
    return f"{h}:{m:02d}:{s:02d}.{cc:02d}"
def ass_escape(text):
    return text.replace('\\','\\\\').replace('{','\\{').replace('}','\\}')
ass_path=text_dir/'section2_body_generated.ass'
lines=['[Script Info]','ScriptType: v4.00+','PlayResX: 1080','PlayResY: 1920','WrapStyle: 0','ScaledBorderAndShadow: yes','[V4+ Styles]',
'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
f"Style: Body,{c['font_family_ass']},{lay['body_font_size']},&H00662C10,&H00662C10,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1",
f"Style: Suffix,{c['font_family_ass']},{lay['suffix_font_size']},&H00662C10,&H00662C10,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1",
'[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
# suffix holds full section
lines.append(f"Dialogue: 0,{ass_time(0)},{ass_time(dur)},Suffix,,0,0,0,,{{\\pos({lay['suffix_x']+95},{lay['suffix_y']+95})\\fad(180,{anim['fade_out_ms']})}}{ass_escape(c['stat_suffix'])}")
for i, txt in enumerate(c['body_lines']):
    start=anim['body_first_start']+i*anim['body_stagger']
    y=lay['body_start_y']+i*lay['body_line_gap']
    y0=y+anim['body_slide_px']
    lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(dur-0.05)},Body,,0,0,0,,{{\\fad({anim['fade_in_ms']},{anim['fade_out_ms']})\\move(540,{y0},540,{y},0,360)}}{ass_escape(txt)}")
ass_path.write_text('\n'.join(lines)+'\n')
# number count: for generic stat, use orange/magenta split only for 95; count-up single magenta before final.
# Final visible digit split for 95 is overlaid after count_duration to mimic gradient-like AE look.
stat=c['stat_value']; count_d=anim['count_duration']
vf=(
 f"drawbox=x={lay['card_x']}:y={lay['card_y']}:w={lay['card_w']}:h={lay['card_h']}:color={colors['card']}@1:t=fill,"
 f"drawtext=fontfile='{font_file}':text='%{{eif\\:min({stat}\\,max(0\\,t*{stat/count_d:.6f}))\\:d}}':fontcolor={colors['stat_left']}:fontsize={lay['stat_font_size']}:x={lay['stat_x']}:y={lay['stat_y']}:enable='lt(t,{count_d})',"
 f"drawtext=fontfile='{font_file}':text='9':fontcolor={colors['stat_left']}:fontsize={lay['stat_font_size']}:x={lay['stat_x']}:y={lay['stat_y']}:enable='gte(t,{count_d})',"
 f"drawtext=fontfile='{font_file}':text='5':fontcolor={colors['stat_right']}:fontsize={lay['stat_font_size']}:x={lay['stat_x']+205}:y={lay['stat_y']}:enable='gte(t,{count_d})',"
 f"subtitles='{ass_path}':fontsdir='{font_dir}',"
 f"fade=t=in:st=0:d=0.20,fade=t=out:st={dur-0.25}:d=0.25"
)
cmd=['ffmpeg','-y','-f','lavfi','-i',f"color=c={colors['background']}:s={c['size']}:r={c['fps']}:d={dur}",'-vf',vf,'-an','-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',str(out)]
print('Running:', ' '.join(shlex.quote(x) for x in cmd))
subprocess.run(cmd, check=True)
subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size,bit_rate:stream=width,height,codec_name,r_frame_rate','-of','json',str(out)], check=True, stdout=open(out.with_suffix('.ffprobe.json'),'w'))
print(out)
