#!/usr/bin/env python3
from pathlib import Path
import html, bisect
ROOT = Path('projects/V0001 Template System - 2026-05-12/section2')
FRAMES = ROOT/'work/anim_v19_frames'
FRAMES.mkdir(parents=True, exist_ok=True)
fps=30; dur=5; n=fps*dur
lines=["of U.S. publicly","posted jobs stay","invisible to","candidates who","don't know","to search them"]
# AE-like milestones based on user's screenshots
keys=[(0.00,0),(0.55,5),(1.55,24),(2.80,76),(3.70,92),(4.25,95),(5.00,95)]
def clamp(x,a=0,b=1): return max(a,min(b,x))
def ease(x): x=clamp(x); return x*x*(3-2*x)
def val_at(t):
    for idx in range(len(keys)-1):
        t0,v0=keys[idx]; t1,v1=keys[idx+1]
        if t<=t1:
            k=ease((t-t0)/(t1-t0)) if t1>t0 else 1
            return round(v0+(v1-v0)*k)
    return 95
# line reveal keyed to screenshot values
thresholds=[5,5,24,76,76,92]
def line_alpha(value, j):
    th=thresholds[j]
    # before threshold: hidden, around threshold: grey/partial, after: navy/full
    if value < th: return 0.0
    # fade over 10 percentage points or instantly for first two lines
    span=10 if j>=2 else 5
    return clamp((value-th)/span)
for i in range(n):
    t=i/fps
    val=val_at(t)
    p=clamp(val/95)
    # number grows/moves from center-ish 0 to final lockup
    pe=ease(p)
    fs=190 + (258-190)*pe
    base_y=760 + (558-760)*pe
    digit_count=len(str(val))
    # x-position shifts left as digits become two digits, matching screenshots
    num_center=540 if digit_count==1 else 436 + (500-436)*pe
    digit_w=fs*0.56*digit_count
    pct_x=num_center + digit_w/2 + fs*0.33
    pct_fs=fs*0.56
    body_start_y=base_y + fs*0.42
    body_fs=78; leading=76
    body=[]
    for j,line in enumerate(lines):
        a=line_alpha(val,j)
        # keep newly appearing lines grey/faded, final navy when full
        opacity=0 if a<=0 else 0.30 + 0.70*a
        y=body_start_y + j*leading + (1-a)*18
        body.append(f'<text x="540" y="{y:.1f}" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="600" font-size="{body_fs}" letter-spacing="0" fill="#002763" opacity="{opacity:.3f}">{html.escape(line)}</text>')
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <radialGradient id="grad9" gradientUnits="userSpaceOnUse" cx="365" cy="455" r="190" fx="398" fy="425"><stop offset="0%" stop-color="#ffd12a"/><stop offset="27%" stop-color="#ff7a20"/><stop offset="52%" stop-color="#e93276"/><stop offset="76%" stop-color="#af18bd"/><stop offset="100%" stop-color="#6535ce"/></radialGradient>
    <radialGradient id="grad5" gradientUnits="userSpaceOnUse" cx="520" cy="450" r="195" fx="505" fy="455"><stop offset="0%" stop-color="#ff9a1d"/><stop offset="30%" stop-color="#fa5749"/><stop offset="56%" stop-color="#d72986"/><stop offset="78%" stop-color="#9430c3"/><stop offset="100%" stop-color="#6236cc"/></radialGradient>
    <radialGradient id="gradNum" gradientUnits="userSpaceOnUse" cx="500" cy="{base_y-105:.1f}" r="220" fx="505" fy="{base_y-125:.1f}"><stop offset="0%" stop-color="#ffd12a"/><stop offset="28%" stop-color="#ff7a20"/><stop offset="55%" stop-color="#e93276"/><stop offset="80%" stop-color="#af18bd"/><stop offset="100%" stop-color="#6535ce"/></radialGradient>
    <filter id="softShadow" x="-18%" y="-18%" width="136%" height="136%"><feDropShadow dx="0" dy="4" stdDeviation="4.8" flood-color="#7a2fd6" flood-opacity="0.15"/></filter>
  </defs>
  <rect x="0" y="0" width="1080" height="1920" fill="#ffffff"/>
  <rect x="50" y="52.5" width="980" height="1815" rx="30" ry="30" fill="#fff5f2"/>
  <g text-anchor="middle">
'''
    if val==95 and t>=4.25:
        svg += '<text x="355" y="558" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="700" font-size="258" letter-spacing="0" fill="url(#grad9)" filter="url(#softShadow)">9</text>\n'
        svg += '<text x="512" y="558" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="700" font-size="258" letter-spacing="0" fill="url(#grad5)" filter="url(#softShadow)">5</text>\n'
        svg += '<text x="662" y="558" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="400" font-size="146" letter-spacing="0" fill="#002763">%</text>\n'
    else:
        svg += f'<text x="{num_center:.1f}" y="{base_y:.1f}" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="700" font-size="{fs:.1f}" letter-spacing="0" fill="url(#gradNum)" filter="url(#softShadow)">{val}</text>\n'
        svg += f'<text x="{pct_x:.1f}" y="{base_y:.1f}" font-family="Graphik Web, Graphik, Arial, sans-serif" font-weight="400" font-size="{pct_fs:.1f}" letter-spacing="0" fill="#002763">%</text>\n'
    svg += '\n'.join(body)
    svg += '\n  </g>\n</svg>\n'
    (FRAMES/f'frame_{i:04d}.svg').write_text(svg)
print(FRAMES)
