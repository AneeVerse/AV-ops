#!/usr/bin/env python3
from __future__ import annotations
import importlib.util
from datetime import datetime, timezone
from pathlib import Path

MASTER = Path('/root/.openclaw/workspace/projects/V0001 Template System - 2026-05-12/master')
BASE_SCRIPT = MASTER / 'scripts' / 'render_batch_v0006_v0015.py'

spec = importlib.util.spec_from_file_location('batch', BASE_SCRIPT)
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)

run_id = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
batch.RUN_ID = run_id
batch.TARGET_IDS = ['V0006']
batch.OUTDIR = MASTER / 'output' / f'Regenerated_V0006_V0001_visual_prompt_{run_id}'
batch.OUTDIR.mkdir(parents=True, exist_ok=True)

V0001_DEVELOPER_PROMPT = """Create a realistic 5-second vertical 9:16 professional B-roll video.

User context:
{USER_TEXT}

Audience:
Software developers. The person must read clearly as a developer within the first second, not a generic corporate employee. Use the context only for mood/activity. Do not show or write the text.

Style:
Realistic cinematic footage, polished career-tech feel, warm natural light, shallow depth of field, clean professional setting.

Scene:
A calm, approachable software developer seated at a modern engineering desk or home-office tech setup, using a laptop with at least one external monitor plus an external keyboard or mouse. Include at least 4 developer cues: hoodie, plain t-shirt, casual overshirt, headphones, external monitor, dual monitors, mechanical keyboard, mouse, engineering desk, blank sticky notes with no readable text, dark IDE-like glow, blurred terminal blocks, code-editor color ambience, tech workspace.

Mood:
Optimistic, focused, confident, professional. Calm focused expression or subtle natural smile only. Avoid posed corporate smiles and clutter.

Camera:
Back-side, side-angle, or over-the-shoulder view; preferably 3/4 rear or side-rear. Camera observes from behind or side, never front-facing. Smooth slow push-in, slow zoom, or subtle side movement only.

Screens:
Screens face the subject, not the camera. Show monitor back, monitor edge, or partial angled glimpse only. Screens may suggest developer work through soft dark glow, blurred IDE-like layouts, terminal-like blurred blocks, or code-editor color ambience. No readable text, code, UI labels, charts, documents, logos, or branding. Avoid direct screen views.

Composition:
Wide medium shot with extra headroom. Keep person, desk, hands, keyboard, devices, props, and action in the lower half/lower third. Top 25-30% must stay clean empty negative space for text overlay: plain wall, ceiling, soft blur, or calm background only. Do not place face, head, laptop, monitor, hands, props, or busy details in the top 25-30%.

Avoid:
blazers, suits, formal shirts, boardrooms, conference rooms, handshakes, meetings, sales offices, generic corporate footage, manager presentation, laptop-only generic work, stock-photo smile, on-screen text, subtitles, logos, readable code/UI/charts/documents, cartoons, animation, holograms, futuristic effects, distorted face/hands, extra fingers, fast motion, shaky camera, low quality."""

def wan_config_v0001_prompt():
    cfg = batch.load_json(batch.VOICE_CONFIG)
    vg = cfg.setdefault('contextual_video_generation', {})
    vg['enabled'] = True
    vg['provider'] = 'replicate'
    vg['model'] = 'kwaivgi/kling-v2.6'
    vg['duration'] = 5
    vg['aspect_ratio'] = '9:16'
    vg['generate_audio'] = False
    vg['negative_prompt'] = 'text, subtitles, logo, visible laptop screen, readable screen, UI overlay, chart, graph, branding, cartoon, animation, CGI, hologram, distorted face, distorted hands, extra fingers, fast camera movement, shaky camera, low quality, front-facing corporate employee, suit, boardroom, conference room'
    vg.setdefault('prompt_templates', {})
    vg['prompt_templates']['section1'] = V0001_DEVELOPER_PROMPT
    vg['prompt_templates']['section3'] = V0001_DEVELOPER_PROMPT
    return cfg

batch.wan_config = wan_config_v0001_prompt

if __name__ == '__main__':
    batch.main()
