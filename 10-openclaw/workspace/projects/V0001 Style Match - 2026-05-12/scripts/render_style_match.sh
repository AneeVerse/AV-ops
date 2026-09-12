#!/usr/bin/env bash
set -euo pipefail
PROJECT=$(readlink -f "$(dirname "$0")/..")
BG="$PROJECT/assets/bg_clips"
PROC="$PROJECT/processed"
OUT="$PROJECT/output"
TXT="$PROJECT/text"
mkdir -p "$PROC" "$OUT"
FONTB=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
# Segment 1: footage + editorial top typography with motion
ffmpeg -y -stream_loop -1 -i "$BG/01_hook.mp4" -t 5 \
  -vf "scale=1152:2048:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0009,1.045)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,eq=saturation=1.10:contrast=1.10:brightness=0.015,subtitles='$TXT/hook.ass'" \
  -an -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p "$PROC/01_hook_style.mp4"
# Segment 2: full-screen blush stat card + count-up typography
ffmpeg -y -f lavfi -i color=c=0xFFF3F4:s=1080x1920:r=30:d=5 \
  -vf "drawbox=x=0:y=0:w=1080:h=1920:color=0xFFF3F4@1:t=fill,drawtext=fontfile=$FONTB:text='%{eif\\:min(95\\,max(0\\,t*48))\\:d}':fontcolor=0xD5007F:fontsize=305:x=(w-text_w)/2-75:y=410:shadowcolor=0xFF6A00@0.18:shadowx=5:shadowy=5,drawtext=fontfile=$FONTB:text='of U.S. publicly posted jobs':fontcolor=0x002B68:fontsize=62:x=(w-text_w)/2:y=850,drawtext=fontfile=$FONTB:text='stay invisible to candidates':fontcolor=0x002B68:fontsize=62:x=(w-text_w)/2:y=935,drawtext=fontfile=$FONTB:textfile=$TXT/stat_line3.txt:fontcolor=0x002B68:fontsize=56:x=(w-text_w)/2:y=1020,subtitles='$TXT/percent.ass',fade=t=in:st=0:d=0.22,fade=t=out:st=4.75:d=0.25" \
  -an -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p "$PROC/02_stat_style.mp4"
# Segment 3: footage + centered bold typography
ffmpeg -y -stream_loop -1 -i "$BG/03_implication.mp4" -t 5 \
  -vf "scale=1152:2048:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0008,1.04)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,eq=saturation=1.08:contrast=1.10:brightness=0.01,drawbox=x=0:y=650:w=1080:h=540:color=black@0.16:t=fill,subtitles='$TXT/implication.ass'" \
  -an -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p "$PROC/03_implication_style.mp4"
# Segment 4: CTA graphic frame inspired by reference: blue/purple gradient, report mockup, magenta CTA
ffmpeg -y -f lavfi -i nullsrc=s=1080x1920:r=30:d=5 \
  -vf "geq=r='20+70*Y/H+80*X/W':g='30+20*X/W':b='120+105*Y/H',format=yuv420p,drawbox=x=92:y=260:w=896:h=760:color=white@0.92:t=fill,drawbox=x=130:y=310:w=820:h=95:color=0xF5F7FF@1:t=fill,drawtext=fontfile=$FONTB:text='TraitDNA™ Work-Style Report':fontcolor=0x002B68:fontsize=43:x=160:y=335,drawbox=x=150:y=470:w=330:h=28:color=0xD5007F@0.85:t=fill,drawbox=x=150:y=540:w=760:h=20:color=0xD9E2FF@1:t=fill,drawbox=x=150:y=590:w=680:h=20:color=0xD9E2FF@1:t=fill,drawbox=x=150:y=640:w=725:h=20:color=0xD9E2FF@1:t=fill,drawbox=x=150:y=735:w=225:h=170:color=0xFFF3F4@1:t=fill,drawbox=x=425:y=735:w=225:h=170:color=0xFFF3F4@1:t=fill,drawbox=x=700:y=735:w=225:h=170:color=0xFFF3F4@1:t=fill,drawtext=fontfile=$FONTB:text='Start with your':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=1125:shadowcolor=0x000000@0.35:shadowx=0:shadowy=4,drawtext=fontfile=$FONTB:text='TraitDNA™ Report':fontcolor=white:fontsize=70:x=(w-text_w)/2:y=1210:shadowcolor=0x000000@0.35:shadowx=0:shadowy=4,drawbox=x=190:y=1385:w=700:h=118:color=0xD5007F@1:t=fill,drawtext=fontfile=$FONTB:text='Free 15-minute report':fontcolor=white:fontsize=49:x=(w-text_w)/2:y=1418,drawtext=fontfile=$FONT:text='No credit card needed':fontcolor=white:fontsize=35:x=(w-text_w)/2:y=1555,fade=t=in:st=0:d=0.22" \
  -an -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p "$PROC/04_cta_style.mp4"
# Final concat + original section voiceovers + bg music
ffmpeg -y -i "$PROC/01_hook_style.mp4" -i "$PROC/02_stat_style.mp4" -i "$PROC/03_implication_style.mp4" -i "$PROC/04_cta_style.mp4" \
 -i "$PROJECT/audio/sections/01_hook.mp3" -i "$PROJECT/audio/sections/02_insight.mp3" -i "$PROJECT/audio/sections/03_implication.mp3" -i "$PROJECT/audio/sections/04_cta.mp3" -i "$PROJECT/audio/soft_bg_music.wav" \
 -filter_complex "[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[vcat];[4:a]adelay=0|0,volume=1.0[a1];[5:a]adelay=5000|5000,volume=1.0[a2];[6:a]adelay=10000|10000,volume=1.0[a3];[7:a]adelay=15000|15000,volume=1.0[a4];[8:a]atrim=0:20,volume=0.10[m];[a1][a2][a3][a4][m]amix=inputs=5:duration=longest:dropout_transition=0[aout]" \
 -map "[vcat]" -map "[aout]" -t 20 -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "$OUT/V0001_Wan27_Style_Match_final.mp4"
ffprobe -v error -show_entries format=duration,size,bit_rate:stream=width,height,codec_name,r_frame_rate -of json "$OUT/V0001_Wan27_Style_Match_final.mp4" > "$OUT/V0001_Wan27_Style_Match_final_ffprobe.json"
