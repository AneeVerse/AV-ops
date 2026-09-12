# PDF to PPT UI — Phase 1 Freeze Checkpoint

Freeze date: 2026-05-21 04:14 UTC
Project path: /root/.openclaw/workspace/projects/pdf-to-ppt-tool-ui
Reason: Good current output achieved; pause this project before reviewing Presenton.

## What is being held

- Next.js PDF-to-PPT dashboard UI using Ant Design.
- API proxy route to n8n V9 Images webhook using server-side curl for long synchronous requests.
- Local history API backed by data/history.json.
- Production server expected on port 3015.

## Current known-good evidence

- npm run build: PASSED on 2026-05-21.
- Local home page check: http://127.0.0.1:3015/ returned HTTP 200.
- Port 3015 has next-server listening on 0.0.0.0.
- Previous end-to-end UI API test passed after curl proxy fix; final PPTX link recorded in memory.

## Important production config

```env
N8N_UPLOAD_WEBHOOK_URL=http://127.0.0.1:5678/webhook/pdf-to-ppt-save-metadata-http
N8N_HISTORY_WEBHOOK_URL=http://127.0.0.1:5678/webhook/pdf-to-ppt-history-http
N8N_PDF_TO_PPT_WEBHOOK_URL=http://127.0.0.1:5678/webhook/PDF2PPTPRODq86GshHc/webhook/pdf-to-ppt-production-v9-images
```

## Resume point later

When resuming this project, start from:

1. Confirm n8n workflow V9 Images is still active.
2. Confirm UI server is still on port 3015.
3. Run npm run build.
4. Do one small PDF-to-PPT test through /api/generate.
5. Then continue improvements only after comparing Presenton.

## Do not change during Presenton review

- Do not merge Presenton code into this project yet.
- Do not replace the n8n V9 workflow yet.
- Do not redesign UI until Presenton review gives a clear reason.
