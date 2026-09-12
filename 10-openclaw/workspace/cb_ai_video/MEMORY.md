# MEMORY.md

## Identity and role

- Agent id/name: `cb_ai_video`.
- Dedicated specialist agent for Ahmad Anees / Content Beta AI video generation work.
- Main responsibility: run and maintain the approved `AI-Video_Gen/template02` automation workflow for TraitDNA / Content Beta AI videos.
- Communicate with Ahmad in a practical, direct, concise way. No guessing; use exact paths, command output, specs, and Drive links.

## Core project memory

- Current approved workflow/template from 2026-07-11 forward: `/root/.openclaw/workspace/AI-Video_Gen/template02`.
- Use the same template02 automation/workflow that produced Ahmad-approved V0046 (`20260711_111012`, Drive `1VRI4TlagNy4bmsshDoaHs2tLrKsZpn4d`) and V0047 (`20260711_112021`, Drive `1xVXcCAoHg6-lcCkcBN5Ej5NpkGvZtq8E`). Ahmad said V0046 was good and instructed to use this workflow/template and the same kind of imagery from here forward.
- Main script: `/root/.openclaw/workspace/AI-Video_Gen/template02/scripts/render_batch_v0006_v0015.py`.
- Source Google Sheet: `1MMslDeXLGBKG6tjPao1_pRIGzaRTOlubwn5UJssB8xE`, tab `300_Video_Master_Attribution`.
- Batch command pattern: `TARGET_IDS='V0047' python3 scripts/render_batch_v0006_v0015.py` from the template02 directory.
- The workflow must generate fresh Section 1 and Section 3 developer/workstation clips every run. V0011 is style reference only, not a clip source.
- Do not use deprecated `AI-Video/template-1`, `projects/AI video automation template-02`, or Truckstop outputs.
- Section 1 and Section 3 imagery should stay the same kind as the accepted template02 outputs: professional/workstation/laptop scenes, acceptable even if generic laptop/workstation rather than strong IDE/code-screen ambience, unless Ahmad asks otherwise.
- Section 4 uses the template02 CTA layout/graphic workflow.
- Final expected specs: 20s, 1080x1920, 30fps, H.264 video, AAC stereo audio.
- Do not do repeated manual visual QC/reroll loops for this workflow. Run the template02 automation, rely on its automated verify/spec output, upload/share, and report link + specs. Only perform manual image QC or rerolls if Ahmad explicitly asks.
- Detailed project knowledge is in `PROJECT_AI_VIDEO.md` in this workspace. Read it before running this workflow, but follow this MEMORY.md override when PROJECT_AI_VIDEO still mentions older master-template/manual-QC defaults.
- Earlier reference: as of 2026-07-09, Ahmad had locked the desired output style/workflow to V0037 from `AI-Video_Gen/template02`; as of 2026-07-11, the latest explicit approved forward workflow is the V0046/V0047 template02 automation flow above.
