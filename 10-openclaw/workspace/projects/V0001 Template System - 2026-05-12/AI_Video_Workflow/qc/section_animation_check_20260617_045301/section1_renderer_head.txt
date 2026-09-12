#!/usr/bin/env python3
import json, pathlib, subprocess, sys, shlex

ROOT = pathlib.Path(__file__).resolve().parents[1]
config_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'config' / 'section1_config.json'
if not config_path.is_absolute():
    config_path = (ROOT / config_path).resolve()
config = json.loads(config_path.read_text())

def relpath(p):
    p = pathlib.Path(p)
    return p if p.is_absolute() else ROOT / p

def ass_time(seconds):
    cs = int(round(float(seconds) * 100))
    h = cs // 360000; cs %= 360000
    m = cs // 6000; cs %= 6000
    s = cs // 100; c = cs % 100
    return f"{h}:{m:02d}:{s:02d}.{c:02d}"

def ass_escape(text):
    return text.replace('\\', '\\\\').replace('{', '\\{').replace('}', '\\}').replace('\n', r'\N')

text_dir = ROOT / 'text'
out_dir = ROOT / 'output'
text_dir.mkdir(parents=True, exist_ok=True)
out_dir.mkdir(parents=True, exist_ok=True)
ass_path = text_dir / 'section1_generated.ass'

style = f"Style: Hook,{config['font_family_ass']},{config['font_size']},{config['font_color_ass']},{config['font_color_ass']},{config['shadow_color_ass']},&H00000000,-1,0,0,0,100,100,-1,0,1,0,{config['shadow_size']},8,{config['safe_margin_left']},{config['safe_margin_right']},{config['safe_margin_top']},1"
lines = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    style,
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
]
for idx, step in enumerate(config['text_reveal_steps']):
    fade_out = 250 if idx == len(config['text_reveal_steps']) - 1 else 0
    tag = f"{{\\fad(80,{fade_out})\\move({config['position_x']},{config['position_y_start']},{config['position_x']},{config['position_y_end']},0,{max(200, int((step['end']-step['start'])*1000))})}}"
    lines.append(f"Dialogue: 0,{ass_time(step['start'])},{ass_time(step['end'])},Hook,,0,0,0,,{tag}{ass_escape(step['text'])}")
ass_path.write_text('\n'.join(lines) + '\n')

clip = relpath(config['clip_path'])
audio = relpath(config['audio_path']) if config.get('audio_path') else None
out = out_dir / config['output_name']
vs = config['video_style']
vf = (
    f"scale={vs['scale_width']}:{vs['scale_height']}:force_original_aspect_ratio=increase,"
    f"crop={vs['crop_width']}:{vs['crop_height']}:x=(iw-ow)/2:y=(ih-oh)/2,"
    f"fps={config['fps']},"
    f"eq=contrast={vs['contrast']}:saturation={vs['saturation']}:brightness={vs['brightness']}:gamma={vs['gamma']},"
    f"subtitles='{ass_path}'"
)
font_dir = config.get('font_dir')
if font_dir:
    fd = relpath(font_dir)
    vf = vf.rsplit("subtitles='", 1)[0] + f"subtitles='{ass_path}':fontsdir='{fd}'"
cmd = ['ffmpeg','-y','-stream_loop','-1','-i',str(clip)]
if audio and audio.exists():
    cmd += ['-i', str(audio)]
cmd += ['-t', str(config['duration_seconds']), '-vf', vf]
if audio and audio.exists():
    cmd += ['-map','0:v','-map','1:a']
else:
    cmd += ['-an']
cmd += ['-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p']
if audio and audio.exists():
    cmd += ['-c:a','aac','-b:a','192k']
cmd += ['-movflags','+faststart', str(out)]
print('Running:', ' '.join(shlex.quote(x) for x in cmd))
subprocess.run(cmd, check=True)
subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size,bit_rate:stream=width,height,codec_name,r_frame_rate','-of','json',str(out)], check=True, stdout=open(out.with_suffix('.ffprobe.json'),'w'))
print(out)
