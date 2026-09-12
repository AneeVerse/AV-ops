#!/usr/bin/env bash
set -euo pipefail
PROJECT=$(readlink -f "$(dirname "$0")/..")
ffmpeg -y -stream_loop -1 -i "$PROJECT/assets/hands_typing_reference_clip.mp4" -i "$PROJECT/audio/reference_section1_audio.m4a" -t 5 \
  -vf "scale=1296:2304:force_original_aspect_ratio=increase,crop=1080:1920:x=(iw-ow)/2:y=(ih-oh)/2,eq=contrast=1.12:saturation=1.20:brightness=0.012:gamma=1.0,subtitles='$PROJECT/text/section1_reveal.ass'" \
  -map 0:v -map 1:a -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "$PROJECT/output/V0001_section1_animated_match_v1.mp4"
ffprobe -v error -show_entries format=duration,size,bit_rate:stream=width,height,codec_name,r_frame_rate -of json "$PROJECT/output/V0001_section1_animated_match_v1.mp4" > "$PROJECT/output/V0001_section1_animated_match_v1_ffprobe.json"
