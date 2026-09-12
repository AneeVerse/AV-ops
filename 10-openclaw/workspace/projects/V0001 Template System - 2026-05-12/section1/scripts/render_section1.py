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

# Smooth line reveal: Section 1 previously swapped cumulative text blocks
# ("Most" -> "Most Software" -> full text), which creates visible jumps.
# Section 3 feels smoother because each line fades/slides in once and remains.
# This keeps the Section 1 design but animates each final line independently.
if config.get('smooth_line_reveal', True):
    final_text = ''
    if config.get('text_reveal_steps'):
        final_text = str(config['text_reveal_steps'][-1].get('text') or '')
    if not final_text:
        final_text = str(config.get('headline_text') or '')
    final_lines = [x.strip() for x in final_text.split('\n') if x.strip()]
    if not final_lines:
        final_lines = [str(config.get('headline_text') or '').strip()]

    starts = config.get('line_reveal_starts') or [0.12, 0.22, 0.34, 0.48, 0.64, 0.82]
    reveal_ms = int(config.get('line_reveal_duration_ms', 320))
    fade_in = int(config.get('line_fade_in_ms', 150))
    fade_out = 0 if config.get('hold_text_until_end', False) else int(config.get('line_fade_out_ms', 250))
    slide_px = int(config.get('line_slide_px', 30))
    line_gap = int(config.get('line_gap', round(config['font_size'] * 0.95)))
    base_y = int(config.get('position_y_end', config.get('position_y_start', 95)))
    end_time = float(config.get('duration_seconds', 5)) + (1.0 if config.get('hold_text_until_end', False) else -0.14)

    for idx, line in enumerate(final_lines):
        start_t = starts[min(idx, len(starts) - 1)]
        y = base_y + idx * line_gap
        y0 = y + slide_px
        tag = f"{{\\fad({fade_in},{fade_out})\\move({config['position_x']},{y0},{config['position_x']},{y},0,{reveal_ms})}}"
        lines.append(f"Dialogue: 0,{ass_time(start_t)},{ass_time(end_time)},Hook,,0,0,0,,{tag}{ass_escape(line)}")
else:
    for idx, step in enumerate(config['text_reveal_steps']):
        fade_out = 250 if idx == len(config['text_reveal_steps']) - 1 else 0
        tag = f"{{\\fad(80,{fade_out})\\move({config['position_x']},{config['position_y_start']},{config['position_x']},{config['position_y_end']},0,{max(200, int((step['end']-step['start'])*1000))})}}"
        lines.append(f"Dialogue: 0,{ass_time(step['start'])},{ass_time(step['end'])},Hook,,0,0,0,,{tag}{ass_escape(step['text'])}")
ass_path.write_text('\n'.join(lines) + '\n')

clip = relpath(config['clip_path'])
audio = relpath(config['audio_path']) if config.get('audio_path') else None
out = out_dir / config['output_name']
vs = config['video_style']
def probe_duration(path):
    try:
        return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(path)], text=True).strip())
    except Exception:
        return float(config.get('duration_seconds', 5))

clip_duration = probe_duration(clip)
render_duration = float(config.get('duration_seconds', 5))
setpts = ''
if config.get('slow_video_to_duration', False) and render_duration > clip_duration > 0:
    setpts = f",setpts={(render_duration / clip_duration):.8f}*PTS"
# Normal full-frame background pipeline.
normal_base_vf = (
    f"scale={vs['scale_width']}:{vs['scale_height']}:force_original_aspect_ratio=increase,"
    f"crop={vs['crop_width']}:{vs['crop_height']}:x=(iw-ow)/2:y=(ih-oh)/2,"
    f"fps={config['fps']},"
    f"eq=contrast={vs['contrast']}:saturation={vs['saturation']}:brightness={vs['brightness']}:gamma={vs['gamma']}"
    f"{setpts}"
)

# Optional Section 1 structural top safe zone. Prompt-only spacing was not
# reliable with generated clips, so this creates an actual blank top area in
# the render. The source video is scaled/cropped into the lower part of the
# frame and the reserved top zone remains clean for the headline overlay.
top_safe_zone_height = int(config.get('top_safe_zone_height', 0))
top_safe_zone_color = str(config.get('top_safe_zone_color', 'black'))
if top_safe_zone_height > 0:
    lower_h = 1920 - top_safe_zone_height
    base_vf = (
        f"scale=1080:{lower_h}:force_original_aspect_ratio=increase,"
        f"crop=1080:{lower_h}:x=(iw-ow)/2:y=(ih-oh)/2,"
        f"fps={config['fps']},"
        f"eq=contrast={vs['contrast']}:saturation={vs['saturation']}:brightness={vs['brightness']}:gamma={vs['gamma']},"
        f"pad=1080:1920:0:{top_safe_zone_height}:color={top_safe_zone_color}"
        f"{setpts}"
    )
else:
    base_vf = normal_base_vf

font_dir = config.get('font_dir')
subtitle_filter = f"subtitles='{ass_path}'"
if font_dir:
    fd = relpath(font_dir)
    subtitle_filter = f"subtitles='{ass_path}':fontsdir='{fd}'"

# Section 1 only: add a soft top black gradient behind the hook text.
# This mirrors Section 3's bottom readability shadow, but inverted because
# Section 1 text sits near the top. It changes only the Section 1 render.
top_shadow_height = int(config.get('top_shadow_height', 840))
top_shadow_alpha = int(config.get('top_shadow_alpha', 210))
grad = (
    "format=rgba,"
    f"geq=r='0':g='0':b='0':a='if(gt(Y,{top_shadow_height}),0,{top_shadow_alpha}*pow(1-Y/{top_shadow_height},2)*(3-2*(1-Y/{top_shadow_height})))'"
)
fc = f"[0:v]{base_vf}[v0];[1:v]{grad}[g];[v0][g]overlay=0:0,{subtitle_filter}[v]"

loop_args = [] if config.get('slow_video_to_duration', False) else ['-stream_loop','-1']
cmd = ['ffmpeg','-y'] + loop_args + ['-i',str(clip),'-f','lavfi','-i','color=c=black@0.0:s=1080x1920:r=30']
if audio and audio.exists():
    cmd += ['-i', str(audio)]
cmd += ['-t', str(config['duration_seconds']), '-filter_complex', fc, '-map', '[v]']
if audio and audio.exists():
    cmd += ['-map','2:a']
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
