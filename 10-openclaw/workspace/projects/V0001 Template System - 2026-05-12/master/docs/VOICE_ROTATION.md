# Contextual WAN Video + Voice + Music Rotation Logic

## Rule

Use the 10 approved voice identities in sequence. For every new video, generate a **fresh new voiceover from the current script text** using the selected voice.

Optionally, the renderer also generates fresh contextual WAN clips for **Section 1** and **Section 3** from their current text before final rendering.

Background music rotates from the files in `../audio/music_rotation/`, sorted by filename. With 7 music files: video 1 uses music 1, video 2 uses music 2, ... video 7 uses music 7, video 8 uses music 1, video 9 uses music 2.

1. Juniper — female
2. Hope — female
3. Sarah — female
4. Alexandra — female
5. Rachel — female
6. Drew — male
7. Paul — male
8. Roger — male
9. James — male
10. Mark — male

After voice 10, restart at voice 1.

Examples:

- Video 1 → generate fresh VO with voice 1 / Juniper
- Video 2 → generate fresh VO with voice 2 / Hope
- Video 10 → generate fresh VO with voice 10 / Mark
- Video 11 → generate fresh VO with voice 1 / Juniper
- Video 12 → generate fresh VO with voice 2 / Hope

## Important

The old MP3 files from the 10 preview videos are **sample/fallback only**. They are not used in normal automation.

Normal automation flow:

1. Get current video/script text
2. If `--generate-contextual-clips` is used, generate fresh WAN clips for Section 1 and Section 3 from their configured text
3. Render Section 1 and Section 3 through the existing text-overlay templates using those WAN clips
4. Rebuild the 20s base video with fresh Sections 1/3 and existing Sections 2/4
5. Read `voice_rotation_state.json`
6. Pick next voice number and next music number
7. Generate a fresh Replicate ElevenLabs VO using that voice
8. Mix VO + selected rotating music into the video
9. Advance state to the next voice number and next music number

## Files

- Voice list/config: `../config/voice_rotation_config.json`
- Persistent state: `../config/voice_rotation_state.json`
- Render script: `../scripts/render_with_rotating_voice.py`
- Generated VO output folder: `../audio/rotating_voice_generated/`
- Rotating music input folder: `../audio/music_rotation/`
- Generated WAN clip folder: `../assets/wan_contextual_clips/`

## Music Files

Put the 7 background music files in:

```text
master/audio/music_rotation/
```

Recommended names:

```text
01.mp3
02.mp3
03.mp3
04.mp3
05.mp3
06.mp3
07.mp3
```

Supported formats: `.mp3`, `.wav`, `.m4a`, `.aac`, `.flac`, `.ogg`.

The renderer sorts by filename, so clean numeric filenames are safest.

## Usage

From the `master/` folder:

```bash
python3 scripts/render_with_rotating_voice.py --peek
```

Shows the next voice without rendering.

```bash
python3 scripts/render_with_rotating_voice.py --dry-run --count 12
```

Shows the upcoming sequence.

```bash
python3 scripts/render_with_rotating_voice.py --voiceover-text-file path/to/current_script.txt --label video_001
```

Generates a fresh VO from `current_script.txt`, renders using the next voice, and advances the state.

```bash
python3 scripts/render_with_rotating_voice.py --text "Script text here" --label video_001
```

Same, but passes the script inline.

```bash
python3 scripts/render_with_rotating_voice.py --generate-contextual-clips --text "Script text here" --label video_001
```

Full automation: generate Section 1 and Section 3 contextual WAN clips, rebuild the 20s base video, generate fresh voiceover, and mix rotating music.

```bash
python3 scripts/render_with_rotating_voice.py --video-number 11 --no-advance --voiceover-text-file path/to/current_script.txt --label video_011
```

Deterministically renders video 11 with voice 1 and music 4 if 7 music files exist, without changing state.

```bash
python3 scripts/render_with_rotating_voice.py --use-fixed-audio --label debug
```

Debug only: uses the old fixed sample audio instead of generating fresh VO.

## Audio Mix

The script applies the existing audio mix:

- base video without contextual generation: `../output/traitdna_full_20s_template_v7_section2_editable.mp4`
- base video with contextual generation: newly rebuilt `traitdna_full_20s_contextual_wan_<label>.mp4`
- music: selected rotating track from `../audio/music_rotation/`; falls back to AE `Corporate.wav` only if no rotation files exist
- music starts audibly from video time 0 by starting 1s into the source track
- music volume: `0.32`
- voice loudnorm target: `-16 LUFS`
- total duration: `20s`
