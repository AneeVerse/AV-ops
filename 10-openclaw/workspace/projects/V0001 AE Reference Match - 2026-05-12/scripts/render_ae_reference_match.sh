#!/usr/bin/env bash
set -euo pipefail
PROJECT=$(readlink -f "$(dirname "$0")/..")
BG="$PROJECT/assets/bg_clips"
IMG="$PROJECT/assets/ae_images"
PROC="$PROJECT/processed"
OUT="$PROJECT/output"
TXT="$PROJECT/text"
mkdir -p "$PROC" "$OUT"
FONTB=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
# Section 1: AE-like clip headline, top centered, no heavy rectangle
ffmpeg -y -stream_loop -1 -i "$BG/ae_hands_typing.mp4" -t 5 \
  -vf "scale=1152:2048:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0007,1.035)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,eq=saturation=1.08:contrast=1.08:brightness=0.01,subtitles='$TXT/sec1.ass'" \
  -an -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p "$PROC/01_section_clip_ae_style.mp4"
# Section 2: AE-like 95Percent1 graphic
ffmpeg -y -f lavfi -i color=c=0xFFF4F4:s=1080x1920:r=30:d=5 \
  -vf "drawbox=x=42:y=42:w=996:h=1836:color=0xFFF7F7@1:t=fill,drawtext=fontfile=$FONTB:text='9':fontcolor=0xBA1B9A:fontsize=360:x=238:y=365,drawtext=fontfile=$FONTB:text='5':fontcolor=0xF27024:fontsize=360:x=443:y=365,drawtext=fontfile=$FONTB:text='of U.S. publicly posted jobs':fontcolor=0x102C66:fontsize=63:x=(w-text_w)/2:y=840,drawtext=fontfile=$FONTB:text='stay invisible to candidates':fontcolor=0x102C66:fontsize=63:x=(w-text_w)/2:y=925,drawtext=fontfile=$FONTB:text='who do not know':fontcolor=0x102C66:fontsize=63:x=(w-text_w)/2:y=1010,drawtext=fontfile=$FONTB:text='what to search.':fontcolor=0x102C66:fontsize=63:x=(w-text_w)/2:y=1095,subtitles='$TXT/sec2_percent.ass',fade=t=in:st=0:d=0.25,fade=t=out:st=4.75:d=0.25" \
  -an -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p "$PROC/02_stat_ae_style.mp4"
# Section 3: AE-like clip caption, lower centered + dark bottom gradient approximation
ffmpeg -y -stream_loop -1 -i "$BG/ae_cafe_man.mp4" -t 5 \
  -vf "scale=1152:2048:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0007,1.035)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,eq=saturation=1.08:contrast=1.08:brightness=0.01,drawbox=x=0:y=1050:w=1080:h=870:color=black@0.18:t=fill,subtitles='$TXT/sec3.ass'" \
  -an -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p "$PROC/03_section_clip_ae_style.mp4"
# Section 4: AE CTA style using collected report/certificate assets
ffmpeg -y -f lavfi -i nullsrc=s=1080x1920:r=30:d=5 \
  -loop 1 -t 5 -i "$IMG/CertificateImage1.png" \
  -loop 1 -t 5 -i "$IMG/CertificateImage2.png" \
  -loop 1 -t 5 -i "$IMG/CertificateImage3.png" \
  -filter_complex "[0:v]geq=r='18+62*X/W+58*Y/H':g='30+20*X/W':b='120+105*Y/H',format=rgba[bg];[1:v]scale=520:-1,rotate=-0.08:c=none:ow=rotw(-0.08):oh=roth(-0.08)[img1];[2:v]scale=520:-1,rotate=0.08:c=none:ow=rotw(0.08):oh=roth(0.08)[img2];[3:v]scale=500:-1[img3];[bg][img1]overlay=x=70:y=225:format=auto[tmp1];[tmp1][img2]overlay=x=495:y=455:format=auto[tmp2];[tmp2][img3]overlay=x=290:y=820:format=auto[tmp3];[tmp3]drawbox=x=92:y=1300:w=896:h=330:color=0x7F24D9@0.86:t=fill,drawtext=fontfile=$FONTB:text='Start with your TraitDNA™':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=1365:shadowcolor=black@0.25:shadowx=0:shadowy=3,drawtext=fontfile=$FONTB:text='Work-Style Report':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=1440:shadowcolor=black@0.25:shadowx=0:shadowy=3,drawtext=fontfile=$FONTB:text='free, 15 minutes.':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=1530:shadowcolor=black@0.25:shadowx=0:shadowy=3,drawtext=fontfile=$FONT:text='Free. 15 minutes. No credit card needed.':fontcolor=white@0.85:fontsize=32:x=(w-text_w)/2:y=1695,fade=t=in:st=0:d=0.25[v]" \
  -map "[v]" -an -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p "$PROC/04_cta_ae_style.mp4"
# Final assembly and audio mix
ffmpeg -y -i "$PROC/01_section_clip_ae_style.mp4" -i "$PROC/02_stat_ae_style.mp4" -i "$PROC/03_section_clip_ae_style.mp4" -i "$PROC/04_cta_ae_style.mp4" \
 -i "$PROJECT/audio/sections/01_hook.mp3" -i "$PROJECT/audio/sections/02_insight.mp3" -i "$PROJECT/audio/sections/03_implication.mp3" -i "$PROJECT/audio/sections/04_cta.mp3" -i "$PROJECT/audio/soft_bg_music.wav" \
 -filter_complex "[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[vcat];[4:a]adelay=0|0,volume=1.0[a1];[5:a]adelay=5000|5000,volume=1.0[a2];[6:a]adelay=10000|10000,volume=1.0[a3];[7:a]adelay=15000|15000,volume=1.0[a4];[8:a]atrim=0:20,volume=0.10[m];[a1][a2][a3][a4][m]amix=inputs=5:duration=longest:dropout_transition=0[aout]" \
 -map "[vcat]" -map "[aout]" -t 20 -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "$OUT/V0001_AE_Reference_Match_v2.mp4"
ffprobe -v error -show_entries format=duration,size,bit_rate:stream=width,height,codec_name,r_frame_rate -of json "$OUT/V0001_AE_Reference_Match_v2.mp4" > "$OUT/V0001_AE_Reference_Match_v2_ffprobe.json"
