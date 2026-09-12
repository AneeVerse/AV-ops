#!/usr/bin/env python3
"""Editable Section 2 renderer.

Change section2/config/section2_editable_match.json to edit:
- stat_value
- stat_suffix
- body_lines
- output_name
"""
from pathlib import Path
import json, html, subprocess, sys, shutil

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / 'config' / 'section2_editable_match.json'
config_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CONFIG
if not config_path.is_absolute():
    config_path = (ROOT / config_path).resolve()

if not config_path.exists():
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps({
        "duration_seconds": 5,
        "fps": 30,
        "size": [1080, 1920],
        "stat_value": 95,
        "stat_suffix": "%",
        "body_lines": [
            "of U.S. publicly",
            "posted jobs stay",
            "invisible to",
            "candidates who",
            "don't know",
            "to search them"
        ],
        "output_name": "section2_editable_match_95_v1.mp4",
        "audio_reference": "../../V0001 Sections 1-2 AE Match - 2026-05-12/output/V0001_section2_only_from_reference_v1.mp4"
    }, indent=2))

cfg = json.loads(config_path.read_text())
W, H = cfg.get('size', [1080, 1920])
fps = int(cfg.get('fps', 30))
dur = float(cfg.get('duration_seconds', 5))
n = int(round(fps * dur))
stat = int(cfg.get('stat_value', 95))
prefix = cfg.get('stat_prefix', '')
suffix = cfg.get('stat_suffix', '%')
body_lines = cfg.get('body_lines', [])

def wrap_body_lines(lines, max_chars=14, max_lines=7):
    """Safety guard: prevent long Section 2 lines from overflowing the card.

    Important: never drop an already-prewrapped final line. The previous guard used
    a global word count while processing each raw line, which could discard the last
    V0011 line (“know to search for them.”).
    """
    out = []
    for raw in lines:
        if len(out) >= max_lines:
            break
        words = str(raw or '').split()
        cur = ''
        for w in words:
            if not cur:
                cur = w
            elif len(cur) + 1 + len(w) <= max_chars:
                cur += ' ' + w
            else:
                if len(out) < max_lines:
                    out.append(cur)
                cur = w
                if len(out) >= max_lines:
                    break
        if cur and len(out) < max_lines:
            out.append(cur)
    return out[:max_lines]

body_lines = wrap_body_lines(body_lines, int(cfg.get('body_max_chars', 14)), int(cfg.get('body_max_lines', 7)))
out = ROOT / 'output' / cfg.get('output_name', f'section2_editable_match_{stat}_v1.mp4')
frames = ROOT / 'work' / 'editable_match_frames'
qc = ROOT / 'qc' / out.stem
for d in [out.parent, frames, qc]: d.mkdir(parents=True, exist_ok=True)
# Clear prior frames to avoid stale renders.
for p in frames.glob('frame_*.svg'): p.unlink()

# Reference-like timing: starts at 0, rises very quickly to high values, settles on final.
keys = cfg.get('count_keys') or [[0.00, 0], [0.25, 0], [0.60, max(0, round(stat*0.86))], [1.05, stat], [dur, stat]]
line_starts = cfg.get('line_starts') or [0.38, 0.48, 0.62, 0.78, 0.94, 1.10]
line_fade = float(cfg.get('line_fade_seconds', 0.28))

def clamp(x, a=0, b=1): return max(a, min(b, x))
def smooth(x):
    x = clamp(x)
    return x*x*(3-2*x)
def val_at(t):
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            return round(v0 + (v1-v0)*smooth((t-t0)/(t1-t0)))
    return stat

def num_group(val, p):
    # Final layout tuned against trimmed 95% reference.
    if p >= 0.985:
        s = str(val)
        digit_fs = 340
        pct_fs = 190
        digit_gap = 198
        total_digit_w = len(s) * digit_gap
        start_x = 365 - (len(s)-2)*95
        y = 700
        pct_x = start_x + total_digit_w + 30
        pct_y = 700
    else:
        digit_fs = 285 + (340-285)*p
        pct_fs = 155 + (190-155)*p
        s = str(val)
        y = 860 + (700-860)*p
        start_x = 540 - (len(s)-1) * digit_fs*0.30
        pct_x = start_x + len(s)*digit_fs*0.47 + 20*p
        pct_y = y
    svg = []
    # Shadow duplicate for soft AE-like depth.
    shadow_opacity = 0.13
    prefix_svg = ''
    # Keep the approximate marker visible throughout, but avoid the earlier horizontal jump.
    # X can be locked to the final good position while Y/scale animate with the number.
    if prefix and p >= float(cfg.get('stat_prefix_min_progress', 0.985)):
        prefix_fs = pct_fs
        prefix_x_factor = float(cfg.get('stat_prefix_x_factor', 0.48))
        prefix_y_offset = float(cfg.get('stat_prefix_y_offset', 0))
        if cfg.get('stat_prefix_lock_final_position', False):
            final_start_x = float(cfg.get('stat_prefix_final_start_x', 365))
            final_y = float(cfg.get('stat_prefix_final_y', 700))
            final_pct_fs = float(cfg.get('stat_prefix_final_font_size', 190))
            if not cfg.get('stat_prefix_animate_scale', False):
                prefix_fs = final_pct_fs
            prefix_x = final_start_x - final_pct_fs * prefix_x_factor
            prefix_y = (y if cfg.get('stat_prefix_animate_y', False) else final_y) + prefix_y_offset
        else:
            prefix_x = start_x - prefix_fs * prefix_x_factor
            prefix_y = y + prefix_y_offset
        # Prefix should visually belong to the main statistic, so it uses the
        # same gradient treatment as the animated number instead of body-text blue.
        prefix_svg = f'<text x="{prefix_x+4:.1f}" y="{prefix_y+5:.1f}" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="700" font-size="{prefix_fs:.1f}" fill="#7a2fd6" opacity="{shadow_opacity}">{html.escape(str(prefix))}</text>'
        prefix_svg += f'<text x="{prefix_x:.1f}" y="{prefix_y:.1f}" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="700" font-size="{prefix_fs:.1f}" fill="url(#gradNum)">{html.escape(str(prefix))}</text>'
    if p >= 0.985 and len(s) == 2:
        positions = [start_x, start_x + digit_gap]
        for idx, ch in enumerate(s):
            grad = 'gradA' if idx == 0 else 'gradB'
            svg.append(f'<text x="{positions[idx]+4:.1f}" y="{y+5:.1f}" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="700" font-size="{digit_fs}" fill="#7a2fd6" opacity="{shadow_opacity}">{html.escape(ch)}</text>')
            svg.append(f'<text x="{positions[idx]:.1f}" y="{y:.1f}" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="700" font-size="{digit_fs}" fill="url(#{grad})">{html.escape(ch)}</text>')
    else:
        svg.append(f'<text x="{start_x+4:.1f}" y="{y+5:.1f}" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="700" font-size="{digit_fs:.1f}" fill="#7a2fd6" opacity="{shadow_opacity}">{html.escape(s)}</text>')
        svg.append(f'<text x="{start_x:.1f}" y="{y:.1f}" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="700" font-size="{digit_fs:.1f}" fill="url(#gradNum)">{html.escape(s)}</text>')
    # Draw the prefix after the animated digits so it cannot be hidden by digit shadows during the two-digit transition.
    if prefix_svg:
        svg.append(prefix_svg)
    svg.append(f'<text x="{pct_x:.1f}" y="{pct_y:.1f}" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="400" font-size="{pct_fs:.1f}" fill="#002763">{html.escape(suffix)}</text>')
    return '\n'.join(svg)

for i in range(n):
    t = i / fps
    val = val_at(t)
    p = clamp(val / stat if stat else 1)
    body_fs = float(cfg.get('body_font_size', 84))
    leading = float(cfg.get('body_line_gap', 114))
    body_start_y = float(cfg.get('body_start_y', 930))
    body_svg=[]
    for j, line in enumerate(body_lines):
        st = line_starts[min(j, len(line_starts)-1)] if line_starts else 0
        a = clamp((t-st)/line_fade)
        ae = smooth(a)
        opacity = 0 if a <= 0 else 0.16 + 0.84*ae
        y = body_start_y + j*leading + (1-ae)*18
        body_svg.append(f'<text x="540" y="{y:.1f}" text-anchor="middle" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="600" font-size="{body_fs}" fill="#002763" opacity="{opacity:.3f}">{html.escape(line)}</text>')
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs>
    <radialGradient id="gradA" gradientUnits="userSpaceOnUse" cx="390" cy="470" r="260" fx="420" fy="450"><stop offset="0%" stop-color="#ffd42e"/><stop offset="28%" stop-color="#ff8a1e"/><stop offset="54%" stop-color="#ee3b72"/><stop offset="78%" stop-color="#b51fc1"/><stop offset="100%" stop-color="#6b35cc"/></radialGradient>
    <radialGradient id="gradB" gradientUnits="userSpaceOnUse" cx="570" cy="475" r="260" fx="540" fy="470"><stop offset="0%" stop-color="#ffa21d"/><stop offset="32%" stop-color="#fa6041"/><stop offset="58%" stop-color="#de2b83"/><stop offset="80%" stop-color="#9430c3"/><stop offset="100%" stop-color="#6236cc"/></radialGradient>
    <radialGradient id="gradNum" gradientUnits="userSpaceOnUse" cx="500" cy="{610-110*p:.1f}" r="260" fx="510" fy="{585-100*p:.1f}"><stop offset="0%" stop-color="#ffd42e"/><stop offset="30%" stop-color="#ff8a1e"/><stop offset="56%" stop-color="#ee3b72"/><stop offset="80%" stop-color="#b51fc1"/><stop offset="100%" stop-color="#6b35cc"/></radialGradient>
  </defs>
  <rect x="0" y="0" width="1080" height="1920" fill="#ffffff"/>
  <rect x="50" y="52" width="980" height="1816" rx="30" ry="30" fill="#fff5f2"/>
  <g text-anchor="middle">
    {num_group(val, p)}
  </g>
  {''.join(body_svg)}
</svg>
'''
    (frames / f'frame_{i:04d}.svg').write_text(svg)

cmd = ['ffmpeg','-y','-framerate',str(fps),'-i',str(frames/'frame_%04d.svg')]
audio_ref = cfg.get('audio_reference')
if audio_ref:
    ar = (ROOT / audio_ref).resolve() if not Path(audio_ref).is_absolute() else Path(audio_ref)
    if ar.exists(): cmd += ['-i', str(ar)]
cmd += ['-map','0:v:0']
if audio_ref and 'ar' in locals() and ar.exists(): cmd += ['-map','1:a?']
cmd += ['-t',str(dur),'-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',str(out)]
subprocess.run(cmd, check=True)
subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size,bit_rate:stream=width,height,codec_name,r_frame_rate','-of','json',str(out)], check=True, stdout=open(str(out)+'.ffprobe.json','w'))
# QC contact sheet
for old in qc.glob('*.jpg'): old.unlink()
for t in [0.2,0.6,1.0,1.4,2.5,4.5]:
    subprocess.run(['ffmpeg','-y','-ss',str(t),'-i',str(out),'-frames:v','1',str(qc/f'frame_{t}s.jpg')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
subprocess.run(['ffmpeg','-y','-pattern_type','glob','-i',str(qc/'frame_*.jpg'),'-vf','scale=180:-1,tile=6x1','-frames:v','1',str(qc/'contact.jpg')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print(out)
print(qc/'contact.jpg')
