# WAN Contextual Clips

This folder stores generated WAN section clips.

When running:

```bash
python3 scripts/render_with_rotating_voice.py --generate-contextual-clips --text "..." --label video_001
```

the renderer generates:

- Section 1 WAN clip from Section 1 text
- Section 3 WAN clip from Section 3 text

Then it renders those clips through the existing Section 1/3 text-overlay templates, rebuilds the 20s base video, generates fresh voiceover, and mixes rotating background music.
