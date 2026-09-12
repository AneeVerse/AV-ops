#!/usr/bin/env python3
import json, pathlib, subprocess, sys, shlex
ROOT=pathlib.Path(__file__).resolve().parents[1]
PROJECT=ROOT.parent
config_path=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'config'/'full_video_config.json'
if not config_path.is_absolute(): config_path=(ROOT/config_path).resolve()
c=json.loads(config_path.read_text())
work=ROOT/'work'; out_dir=ROOT/'output'; qc=ROOT/'qc'
for d in (work,out_dir,qc): d.mkdir(parents=True, exist_ok=True)
default_section_duration=float(c['section_duration_seconds'])
fps=int(c['fps'])
normalized=[]
for idx, sec in enumerate(c['sections'], start=1):
    src=(ROOT/pathlib.Path(sec['source'])).resolve()
    if not src.exists():
        raise FileNotFoundError(f"Missing section source: {src}")
    dst=work/f"{idx:02d}_{sec['id']}_normalized.mp4"
    section_duration=float(sec.get('duration_seconds', default_section_duration))
    # Normalize every section to its configured duration, 1080x1920, 30fps, no audio.
    vf=f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps={fps},tpad=stop_mode=clone:stop_duration={section_duration},trim=duration={section_duration},setpts=PTS-STARTPTS"
    cmd=['ffmpeg','-y','-i',str(src),'-t',str(section_duration),'-vf',vf,'-an','-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',str(dst)]
    print('Normalize:', ' '.join(shlex.quote(x) for x in cmd))
    subprocess.run(cmd, check=True)
    normalized.append(dst)
concat_file=work/'concat_list.txt'
concat_file.write_text(''.join(f"file '{p.resolve()}'\n" for p in normalized))
video_only=work/'combined_video_only.mp4'
cmd=['ffmpeg','-y','-f','concat','-safe','0','-i',str(concat_file),'-c','copy',str(video_only)]
print('Concat:', ' '.join(shlex.quote(x) for x in cmd))
subprocess.run(cmd, check=True)
out=out_dir/c['output_name']
total=float(c['total_duration_seconds'])
if c.get('audio_mode') == 'silent_placeholder':
    cmd=['ffmpeg','-y','-i',str(video_only),'-f','lavfi','-i',f'anullsrc=channel_layout=stereo:sample_rate=48000','-t',str(total),'-shortest','-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','128k','-movflags','+faststart',str(out)]
else:
    cmd=['ffmpeg','-y','-i',str(video_only),'-t',str(total),'-c','copy','-movflags','+faststart',str(out)]
print('Mux:', ' '.join(shlex.quote(x) for x in cmd))
subprocess.run(cmd, check=True)
subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size,bit_rate:stream=width,height,codec_name,r_frame_rate','-of','json',str(out)], check=True, stdout=open(out.with_suffix('.ffprobe.json'),'w'))
print(out)
