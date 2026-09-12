#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p work output
FONT="$ROOT/assets/fonts/Industry_Bold.otf"
FONT_REG="$ROOT/assets/fonts/Inter-Regular.otf"
RED="0xD71920"
BG="0xF4F4F1"
BLACK="0x111111"
WHITE="0xFFFFFF"
BODY_RED="0xC01822"

# Section 1: template-driven top text + replaceable UI screenshot.
python3 scripts/render_section_01.py

# Section 2: template-driven background video + animated text/logo.
python3 scripts/render_section_02.py

# Section 3: top text + one screenshot scroll/pan.
ffmpeg -y \
  -loop 1 -t 3.6 -i inputs/sample_screenshots/screenshot_sample_03.jpg \
  -f lavfi -t 3.6 -i "color=c=${BG}:s=1080x1920:r=30" \
  -f lavfi -t 3.6 -i "anullsrc=channel_layout=stereo:sample_rate=48000" \
  -filter_complex "\
    [0:v]scale=1250:-1,format=rgba[s1];\
    [1:v]drawtext=fontfile=${FONT}:text='Hard load?':x=70:y=120:fontsize=82:fontcolor=${BLACK},\
         drawtext=fontfile=${FONT}:text='Get more':x=70:y=218:fontsize=82:fontcolor=${BLACK},\
         drawbox=x=70:y=320:w=430:h=94:color=${RED}:t=fill,\
         drawtext=fontfile=${FONT}:text='visibility.':x=96:y=336:fontsize=64:fontcolor=${WHITE},\
         drawtext=fontfile=${FONT_REG}:text='Use dashboard visibility and performance signals':x=70:y=462:fontsize=34:fontcolor=${BODY_RED},\
         drawtext=fontfile=${FONT_REG}:text='to move difficult loads faster.':x=70:y=512:fontsize=34:fontcolor=${BODY_RED}[base];\
    [base][s1]overlay=x='80-260*t':y=850:shortest=1,format=yuv420p[v]" \
  -map "[v]" -map 2:a -t 3.6 -r 30 -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 18 -c:a aac -ar 48000 -ac 2 -shortest work/section_03.mp4

# Section 4: generated/replaceable video background + animated product intro text.
ffmpeg -y \
  -stream_loop -1 -t 4.7 -i assets/backgrounds/section_04_bg.mp4 \
  -f lavfi -t 4.7 -i "anullsrc=channel_layout=stereo:sample_rate=48000" \
  -filter_complex "\
    [0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,drawbox=x=0:y=0:w=iw:h=ih:color=black@0.08:t=fill,\
    drawbox=x=0:y=70:w=1080:h=470:color=white@0.36:t=fill,\
    drawbox=x=0:y=1380:w=1080:h=210:color=black@0.22:t=fill,\
    drawtext=fontfile=${FONT}:text='Introducing':x=70:y=150:fontsize=76:fontcolor=${BLACK}:alpha='gte(t,0.1)',\
    drawtext=fontfile=${FONT}:text='Wize Load by':x=70:y=242:fontsize=76:fontcolor=${BLACK}:alpha='gte(t,0.25)',\
    drawbox=x=70:y=344:w='min(610\\,610*t/0.55)':h=92:color=${RED}:t=fill,\
    drawtext=fontfile=${FONT}:text='Truckstop.com.':x=95:y=358:fontsize=62:fontcolor=${WHITE}:alpha='gte(t,0.35)',\
    drawtext=fontfile=${FONT_REG}:text='Estimate heavy haul, oversized, and open deck rates':x=70:y=1430:fontsize=34:fontcolor=${WHITE}:alpha='gte(t,0.65)',\
    drawtext=fontfile=${FONT_REG}:text='in seconds before you post.':x=70:y=1480:fontsize=34:fontcolor=${WHITE}:alpha='gte(t,0.8)',format=yuv420p[v]" \
  -map "[v]" -map 1:a -t 4.7 -r 30 -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 18 -c:a aac -ar 48000 -ac 2 -shortest work/section_04.mp4

# Final concat. Outro is appended exactly as the supplied file; we do not edit the outro source asset.
cat > work/concat.txt <<LIST
file '$ROOT/work/section_01.mp4'
file '$ROOT/work/section_02.mp4'
file '$ROOT/work/section_03.mp4'
file '$ROOT/work/section_04.mp4'
file '$ROOT/inputs/outro/outro_keep_as_is.mp4'
LIST
ffmpeg -y -f concat -safe 0 -i work/concat.txt -c copy output/template_02_sample.mp4
