# V0001 Wan 2.7 POC

Fresh V0001 proof-of-concept rendered with 4 new background clips from `wan-video/wan-2.7-t2v`.

Process:
1. Generate 4 Wan 2.7 clips, 5 sec each, 1080p, 9:16.
2. Strip model-native audio from clips.
3. Add deterministic text overlays and 0→95% counter in FFmpeg.
4. Add synced section-by-section TTS voiceover.
5. Add soft background music.
6. Export final 20 sec vertical MP4.

Color note:
- Avoided the global black overlay used in earlier POCs.
- Used only local text/card backgrounds.
- Applied light saturation/contrast preservation during normalization.

Cost:
- See `source/cost_report.md` and `source/cost_report.json`.
