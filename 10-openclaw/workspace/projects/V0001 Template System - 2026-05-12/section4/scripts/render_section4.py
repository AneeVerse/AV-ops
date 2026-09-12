#!/usr/bin/env python3
import json, pathlib, subprocess, sys, html, shlex
ROOT=pathlib.Path(__file__).resolve().parents[1]
config_path=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'config'/'section4_config.json'
if not config_path.is_absolute(): config_path=(ROOT/config_path).resolve()
c=json.loads(config_path.read_text())
def rel(p):
    p=pathlib.Path(p); return p if p.is_absolute() else ROOT/p
assets=ROOT/'assets'; output=ROOT/'output'; assets.mkdir(exist_ok=True); output.mkdir(exist_ok=True)
overlay=assets/'section4_text_only_overlay.svg'
font=c['font_family']
main=[]
for i,line in enumerate(c['main_text']):
    y=c['main_y']+i*c['main_line_gap']
    main.append(f'<text x="540" y="{y}" text-anchor="middle" font-family="{font}" font-weight="{c["main_font_weight"]}" font-size="{c["main_font_size"]}" fill="#ffffff">{html.escape(line)}</text>')
small=[]
for i,line in enumerate(c['small_text']):
    y=c['small_y']+i*c['small_line_gap']
    small.append(f'<text x="540" y="{y}" text-anchor="middle" font-family="{font}" font-weight="{c["small_font_weight"]}" font-size="{c["small_font_size"]}" fill="#ffffff" opacity="0.96">{html.escape(line)}</text>')
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <g>
    {' '.join(main)}
    {' '.join(small)}
  </g>
</svg>'''
overlay.write_text(svg)
bg=rel(c['background_video']); out=output/c['output_name']
dur=c['duration_seconds']; fps=c['fps']; fade=c['animation']['fade_in_seconds']; slide=c['animation']['slide_px']; start=c['animation'].get('start_seconds',0)
fc=(f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
    f"fps={fps},tpad=stop_mode=clone:stop_duration=3,trim=duration={dur},setpts=PTS-STARTPTS[bg];"
    f"[1:v]format=rgba,fps={fps},trim=duration={dur},setpts=PTS-STARTPTS,fade=t=in:st={start}:d={fade}:alpha=1[ov];"
    f"[bg][ov]overlay=x=0:y='if(lt(t,{start}),{slide},if(lt(t,{start}+{fade}),{slide}*(1-(t-{start})/{fade}),0))':enable='gte(t,{start})':format=auto[v]")
cmd=['ffmpeg','-y','-i',str(bg),'-loop','1','-i',str(overlay),'-t',str(dur),'-filter_complex',fc,'-map','[v]','-an','-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',str(out)]
print('Running:', ' '.join(shlex.quote(x) for x in cmd))
subprocess.run(cmd, check=True)
print(out)
