# How to use AI video automation template-02

## Render sample

```bash
cd "/root/.openclaw/workspace/projects/AI video automation template-02"
./scripts/render_template.sh
```

Output:

```text
output/template_02_sample.mp4
```

## Replaceable assets

### Screenshots
Replace these files with future client screenshots:

```text
inputs/sample_screenshots/screenshot_sample_01.jpg
inputs/sample_screenshots/screenshot_sample_02.jpg
inputs/sample_screenshots/screenshot_sample_03.jpg
```

Recommended screenshot size: **1280×720 or higher**.

### Generated video backgrounds
Replace these with AI-generated clean background videos:

```text
assets/backgrounds/section_02_bg.mp4
assets/backgrounds/section_04_bg.mp4
```

Recommended format: **1080×1920, 30fps, no text, no logos**.

### Outro
Use this exactly as provided:

```text
inputs/outro/outro_keep_as_is.mp4
```

Do not crop, recolor, recreate, or modify the outro.

## Copy/text
Current copy is hardcoded in:

```text
scripts/render_template.sh
```

Template planning copy is also stored in:

```text
template_config.json
```

Later improvement: convert the shell renderer into a JSON-driven renderer so copy can be changed from `template_config.json` only.
