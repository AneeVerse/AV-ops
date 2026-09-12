# Frame Extractor UI

Next.js UI for video frame extraction through n8n.

## Features

- Video link input
- Editable extraction name
- Extract by time or by frame
- Interval number or `All`
- Screenshot limit number or `All`
- Output gallery in UI
- Individual image download links
- Download all ZIP link
- History tab with editable names
- Uses Google Drive output parent folder: `128VtgRTZhfYvZkD13LWWYKw5vmRw7aKN`

## Setup

```bash
npm install
NEXT_PUBLIC_N8N_BASE_URL=https://YOUR_N8N_DOMAIN npm run dev
```

Expected n8n webhooks are documented in:

```text
docs/N8N_WORKFLOW_PLAN.md
```

## Notes

- Phase 1 is designed for Google Drive video links.
- YouTube support should be added later through yt-dlp + cookies/proxy because VPS download attempts can be blocked by YouTube bot detection.
- n8n must delete the downloaded source video after frame extraction and upload.
