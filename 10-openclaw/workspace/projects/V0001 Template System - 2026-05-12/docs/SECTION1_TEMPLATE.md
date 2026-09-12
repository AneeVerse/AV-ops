# Section 1 Template

Purpose: reusable hook section for 300-video production.

Editable fields are in:
`section1/config/section1_config.json`

Change these for each video:
- `clip_path` — Section 1 background clip
- `audio_path` — voiceover section audio, optional
- `headline_text` — source copy reference
- `text_reveal_steps` — actual animated line breaks/timing
- `output_name` — exported filename

Locked style fields:
- duration: 5 seconds
- size: 1080x1920
- reveal animation timing pattern
- bold white typography
- crop/color grade defaults

Font note:
- AE reference uses Graphik Web Bold.
- Graphik font file was not included in the AE package.
- Template supports exact font by changing `font_file`/`font_family_ass` once Graphik is provided.
