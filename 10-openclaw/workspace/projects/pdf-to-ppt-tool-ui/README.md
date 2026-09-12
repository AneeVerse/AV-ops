# PDF to PPT Tool UI

Next.js frontend for the PDF-to-PPT MVP.

## Current Scope: Step 2 revised

- Upload a text-based PDF from the browser
- Extract text temporarily in the Next.js API using `pdf-parse`
- Do **not** permanently save the original PDF
- Do **not** permanently save extracted text
- Send only extraction metadata to n8n
- n8n saves minimal job history metadata in Google Drive
- History tab displays job status, page count, and extracted character count

The first meaningful saved artifact will be the AI-generated slide outline in Step 3.

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
N8N_UPLOAD_WEBHOOK_URL=https://YOUR_N8N_DOMAIN/webhook/pdf-to-ppt-save-metadata-http
N8N_HISTORY_WEBHOOK_URL=https://YOUR_N8N_DOMAIN/webhook/pdf-to-ppt-history-http
```

## Run

```bash
npm install
npm run dev
```
