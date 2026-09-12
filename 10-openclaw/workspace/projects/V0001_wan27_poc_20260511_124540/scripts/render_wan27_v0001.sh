#!/usr/bin/env bash
set -euo pipefail
PROJECT=$(readlink -f /root/.openclaw/workspace/projects/V0001_wan27_poc_current)
BG=$PROJECT/assets/bg_clips
OUT=$PROJECT/output
TXT=$PROJECT/text
PROC=$PROJECT/processed
mkdir -p "$OUT" "$TXT" "$PROC"
cat > "$TXT/hook.txt" <<'EOF'
Most Software Developers
qualify for more job titles
than they apply to.
EOF
cat > "$TXT/insight.txt" <<'EOF'
of U.S. publicly posted jobs
stay invisible to candidates
who don't know what to search.
EOF
cat > "$TXT/implication.txt" <<'EOF'
Your strongest matches
may be roles you've
never searched.
EOF
cat > "$TXT/cta.txt" <<'EOF'
Start with your TraitDNA™
Work-Style Report
EOF
cat > "$TXT/cta_sub.txt" <<'EOF'
Free. 15 minutes. No credit card.
EOF
cat > "$TXT/percent.txt" <<'EOF'
\%
EOF
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
FONTREG=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
# Normalize clips, strip model-native audio, keep colors vivid. No global dark overlay.
for f in 01_hook 02_insight 03_implication 04_cta; do
  ffmpeg -y -stream_loop -1 -i "$BG/$f.mp4" -t 5 \
    -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,eq=saturation=1.08:contrast=1.03:brightness=0.01" \
    -an -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p "$PROC/$f.mp4" >/tmp/wan27_${f}_norm.log 2>&1
done
FILTER_VIDEO="[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0,format=yuv420p[base];[base]drawtext=fontfile=$FONT:textfile=$TXT/hook.txt:fontcolor=white:fontsize=62:line_spacing=14:box=1:boxcolor=black@0.48:boxborderw=32:x=(w-text_w)/2:y=250:enable='between(t,0,5)'[v1];[v1]drawbox=x=80:y=360:w=920:h=820:color=white@0.90:t=fill:enable='between(t,5,10)'[v2];[v2]drawtext=fontfile=$FONT:text='%{eif\\:min(95\\,max(0\\,(t-5)*42))\\:d}':fontcolor=0xF65B9A:fontsize=205:x=(w-text_w)/2-45:y=470:enable='between(t,5,10)'[vnum];[vnum]drawtext=fontfile=$FONT:textfile=$TXT/percent.txt:fontcolor=0xF65B9A:fontsize=150:x=650:y=500:enable='between(t,5,10)'[v3];[v3]drawtext=fontfile=$FONTREG:textfile=$TXT/insight.txt:fontcolor=0x14213D:fontsize=46:line_spacing=12:x=(w-text_w)/2:y=780:enable='between(t,5,10)'[v4];[v4]drawtext=fontfile=$FONT:textfile=$TXT/implication.txt:fontcolor=white:fontsize=66:line_spacing=14:box=1:boxcolor=black@0.48:boxborderw=34:x=(w-text_w)/2:y=620:enable='between(t,10,15)'[v5];[v5]drawbox=x=70:y=1060:w=940:h=600:color=black@0.52:t=fill:enable='between(t,15,20)'[v6];[v6]drawtext=fontfile=$FONT:textfile=$TXT/cta.txt:fontcolor=white:fontsize=60:line_spacing=12:x=(w-text_w)/2:y=1190:enable='between(t,15,20)'[v7];[v7]drawtext=fontfile=$FONTREG:textfile=$TXT/cta_sub.txt:fontcolor=white:fontsize=36:x=(w-text_w)/2:y=1415:enable='between(t,15,20)'[vout]"
ffmpeg -y -i "$PROC/01_hook.mp4" -i "$PROC/02_insight.mp4" -i "$PROC/03_implication.mp4" -i "$PROC/04_cta.mp4" \
 -i "$PROJECT/audio/sections/01_hook.mp3" -i "$PROJECT/audio/sections/02_insight.mp3" -i "$PROJECT/audio/sections/03_implication.mp3" -i "$PROJECT/audio/sections/04_cta.mp3" -i "$PROJECT/audio/soft_bg_music.wav" \
 -filter_complex "$FILTER_VIDEO;[4:a]adelay=0|0,volume=1.0[a1];[5:a]adelay=5000|5000,volume=1.0[a2];[6:a]adelay=10000|10000,volume=1.0[a3];[7:a]adelay=15000|15000,volume=1.0[a4];[8:a]atrim=0:20,volume=0.10[m];[a1][a2][a3][a4][m]amix=inputs=5:duration=longest:dropout_transition=0[aout]" \
 -map "[vout]" -map "[aout]" -t 20 -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "$OUT/V0001_Wan27_POC_final.mp4"
ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of json "$OUT/V0001_Wan27_POC_final.mp4" > "$OUT/V0001_Wan27_POC_final_ffprobe.json"
