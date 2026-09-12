#!/usr/bin/env python3
"""Section 2.5 renderer for Insight_Text rows without ~95 / 95%.

This is a copy/variant of Section 2's card style, but intentionally removes
all statistic elements: no ~, no 95, no %. It renders the Insight_Text as a
larger centered text block for longer non-stat insight lines.
"""
from pathlib import Path
import json, html, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / 'config' / 'section2_5_text_only.json'
config_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CONFIG
if not config_path.is_absolute():
    config_path = (ROOT / config_path).resolve()

cfg = json.loads(config_path.read_text())
W, H = cfg.get('size', [1080, 1920])
fps = int(cfg.get('fps', 30))
dur = float(cfg.get('duration_seconds', 5))
n = int(round(fps * dur))
raw_lines = cfg.get('body_lines', [])
out = ROOT / 'output' / cfg.get('output_name', 'section2_5_text_only_v1.mp4')
frames = ROOT / 'work' / 'section2_5_text_only_frames'
qc = ROOT / 'qc' / out.stem
for d in [out.parent, frames, qc]: d.mkdir(parents=True, exist_ok=True)
for p in frames.glob('frame_*.svg'): p.unlink()

def wrap_text(text_or_lines, max_chars=24, max_lines=6):
    """Wrap body copy without creating an over-wide final line.

    Previous behavior treated max_lines as hard and collapsed all remaining
    words into the final line. That caused clipping for rows like V0007 where
    the last line became much wider than the card. Here max_lines is treated as
    a soft target: keep all words, then the font/leading is fitted below.
    """
    if cfg.get('preserve_body_lines') and isinstance(text_or_lines, list):
        return [' '.join(str(x or '').split()) for x in text_or_lines if str(x or '').strip()]
    text = ' '.join(' '.join(str(x or '').split()) for x in text_or_lines) if isinstance(text_or_lines, list) else ' '.join(str(text_or_lines or '').split())
    words = text.split()
    lines=[]; cur=''
    for w in words:
        if not cur:
            cur=w
        elif len(cur)+1+len(w) <= max_chars:
            cur += ' ' + w
        else:
            lines.append(cur); cur=w
    if cur:
        lines.append(cur)
    return lines

def fit_text_metrics(lines, base_fs, base_leading, safe_width, max_block_h=1180):
    """Reduce font/leading when needed so wrapped lines stay inside safe area."""
    fs = int(base_fs)
    leading = int(base_leading)
    if not lines:
        return fs, leading
    # Conservative SVG text width estimate for bold Graphik/Arial.
    widest = max(len(line) for line in lines)
    if widest:
        fs = min(fs, int(safe_width / max(1, widest * 0.58)))
    if len(lines) > 1:
        leading = min(leading, int(max_block_h / (len(lines) - 1)))
    leading = min(leading, int(fs * 1.42))
    fs = max(46, fs)
    leading = max(64, leading)
    return fs, leading

def clamp(x,a=0,b=1): return max(a,min(b,x))
def smooth(x):
    x=clamp(x); return x*x*(3-2*x)

lines = wrap_text(raw_lines, int(cfg.get('body_max_chars',24)), int(cfg.get('body_max_lines',6)))
body_fs = int(cfg.get('body_font_size', 86))
leading = int(cfg.get('body_leading', 128))
body_fs, leading = fit_text_metrics(lines, body_fs, leading, int(cfg.get('safe_text_width', 840)))
block_h = (len(lines)-1)*leading if lines else 0
body_start_y = int(cfg.get('body_start_y', 520))
# If many lines, keep block visually centered inside the card.
if cfg.get('auto_center_y', True):
    body_start_y = int((H - block_h) / 2 - 35)
line_starts = cfg.get('line_starts') or [0.20,0.34,0.50,0.68,0.86,1.04]
line_fade = float(cfg.get('line_fade_seconds',0.36))

for i in range(n):
    t = i / fps
    body_svg=[]
    for j,line in enumerate(lines):
        st = line_starts[min(j, len(line_starts)-1)]
        a = clamp((t-st)/line_fade)
        ae = smooth(a)
        opacity = 0 if a <= 0 else 0.14 + 0.86*ae
        y = body_start_y + j*leading + (1-ae)*22
        # subtle shadow + main body text, matching Section 2 blue family
        safe = html.escape(line)
        body_svg.append(f'<text x="544" y="{y+4:.1f}" text-anchor="middle" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="700" font-size="{body_fs}" fill="#7a2fd6" opacity="{0.07*opacity:.3f}">{safe}</text>')
        body_svg.append(f'<text x="540" y="{y:.1f}" text-anchor="middle" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="700" font-size="{body_fs}" fill="#002763" opacity="{opacity:.3f}">{safe}</text>')
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <rect x="0" y="0" width="1080" height="1920" fill="#ffffff"/>
  <rect x="50" y="52" width="980" height="1816" rx="30" ry="30" fill="#fff5f2"/>
  {''.join(body_svg)}
</svg>
'''
    (frames / f'frame_{i:04d}.svg').write_text(svg)

cmd = ['ffmpeg','-y','-framerate',str(fps),'-i',str(frames/'frame_%04d.svg')]
audio_ref = cfg.get('audio_reference')
ar = None
if audio_ref:
    ar = (ROOT / audio_ref).resolve() if not Path(audio_ref).is_absolute() else Path(audio_ref)
    if ar.exists(): cmd += ['-i', str(ar)]
cmd += ['-map','0:v:0']
if ar and ar.exists(): cmd += ['-map','1:a?']
cmd += ['-t',str(dur),'-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',str(out)]
subprocess.run(cmd, check=True)
subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size,bit_rate:stream=width,height,codec_name,r_frame_rate','-of','json',str(out)], check=True, stdout=open(str(out)+'.ffprobe.json','w'))
for old in qc.glob('*.jpg'): old.unlink()
for t in [0.2,0.6,1.0,1.4,2.5,4.5]:
    subprocess.run(['ffmpeg','-y','-ss',str(t),'-i',str(out),'-frames:v','1',str(qc/f'frame_{t}s.jpg')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
subprocess.run(['ffmpeg','-y','-pattern_type','glob','-i',str(qc/'frame_*.jpg'),'-vf','scale=180:-1,tile=6x1','-frames:v','1',str(qc/'contact.jpg')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print(out)
print(qc/'contact.jpg')
