# n8n Workflow Plan - Frame Extractor

## Goal

A Next.js UI sends video extraction requests to n8n. n8n downloads the video, extracts frames with ffmpeg, uploads images to Google Drive folder `128VtgRTZhfYvZkD13LWWYKw5vmRw7aKN`, deletes the source video from local disk, and returns image links for the UI gallery/history.

## Fixed output folder

Google Drive parent folder:

```text
128VtgRTZhfYvZkD13LWWYKw5vmRw7aKN
```

Each extraction should create a child folder named from the video title/file name, e.g.

```text
Meet Ramp - 2026-05-14 05-40
```

The extraction name must be editable later.

## Frontend env

Set this in Next.js deployment:

```bash
NEXT_PUBLIC_N8N_BASE_URL=https://YOUR_N8N_DOMAIN
```

The UI calls these n8n endpoints:

```text
POST /webhook/frame-extractor/start
GET  /webhook/frame-extractor/status?jobId=...
GET  /webhook/frame-extractor/history
POST /webhook/frame-extractor/rename
```

## Data model

Store job records in n8n Data Store, Supabase, SQLite, or a JSON file. Recommended: Supabase or n8n Data Store.

```json
{
  "id": "job_...",
  "name": "Video title or user edited name",
  "videoUrl": "https://drive.google.com/file/d/...",
  "mode": "time",
  "interval": 5,
  "limit": "all",
  "status": "queued|processing|done|failed",
  "createdAt": "2026-05-14T05:40:00Z",
  "updatedAt": "2026-05-14T05:42:00Z",
  "outputDriveFolderId": "...",
  "driveFolderUrl": "https://drive.google.com/drive/folders/...",
  "zipUrl": "https://drive.google.com/file/d/...",
  "possibleCount": 32,
  "images": [
    {
      "id": "frame_0001",
      "name": "frame_0001.jpg",
      "url": "https://...previewable-image-url...",
      "downloadUrl": "https://...download-url...",
      "driveFileId": "...",
      "timestamp": 0,
      "frameNumber": 0
    }
  ],
  "error": null
}
```

## Endpoint 1: Start extraction

### Request

```json
{
  "videoUrl": "https://drive.google.com/file/d/FILE_ID/view?usp=drive_link",
  "name": "Optional custom name",
  "mode": "time",
  "interval": 5,
  "limit": "all",
  "outputDriveFolderId": "128VtgRTZhfYvZkD13LWWYKw5vmRw7aKN"
}
```

`mode` values:

- `time`: `interval` is seconds. `5` means screenshot every 5 seconds.
- `frame`: `interval` is frame count. `5` means every 5th frame.

`interval` can be:

- number >= 1
- `all`

Mapping:

- `mode=time` + `interval=all` => every 1 second. This avoids undefined infinite extraction.
- `mode=frame` + `interval=all` => every frame. Warning: can create very large output.

`limit` can be:

- number >= 1
- `all`

### Immediate response

Return quickly after creating the job. Processing can continue asynchronously.

```json
{
  "jobId": "job_abc123",
  "status": "queued",
  "name": "Meet Ramp",
  "message": "Job started"
}
```

## Endpoint 2: Status

### Request

```text
GET /webhook/frame-extractor/status?jobId=job_abc123
```

### Response

Return the full job record.

```json
{
  "id": "job_abc123",
  "name": "Meet Ramp",
  "status": "done",
  "images": [],
  "zipUrl": "https://...",
  "driveFolderUrl": "https://..."
}
```

## Endpoint 3: History

### Request

```text
GET /webhook/frame-extractor/history
```

### Response

```json
{
  "jobs": [
    {
      "id": "job_abc123",
      "name": "Meet Ramp",
      "status": "done",
      "createdAt": "2026-05-14T05:40:00Z",
      "images": []
    }
  ]
}
```

## Endpoint 4: Rename

### Request

```json
{
  "jobId": "job_abc123",
  "name": "New editable name"
}
```

### Response

```json
{
  "ok": true
}
```

Also rename the Google Drive child folder if possible.

## Processing logic

### 1. Parse Drive file ID

Supported inputs:

```text
https://drive.google.com/file/d/FILE_ID/view
https://drive.google.com/open?id=FILE_ID
FILE_ID
```

### 2. Download video

Use Google Drive node or CLI/API.

Local paths should be job-scoped:

```bash
/work/tmp/frame-extractor/$JOB_ID/video.mp4
/work/tmp/frame-extractor/$JOB_ID/frames/frame_%04d.jpg
```

### 3. Read metadata

```bash
ffprobe -v error \
  -select_streams v:0 \
  -show_entries stream=avg_frame_rate,nb_frames,duration \
  -show_entries format=duration \
  -of json video.mp4
```

Calculate:

- `durationSeconds`
- `fps`
- `totalFrames = durationSeconds * fps` if `nb_frames` unavailable

### 4. Calculate possible screenshot count

If mode = `time`:

```text
actualInterval = interval === "all" ? 1 : interval
possibleCount = floor(durationSeconds / actualInterval) + 1
```

If mode = `frame`:

```text
actualInterval = interval === "all" ? 1 : interval
possibleCount = ceil(totalFrames / actualInterval)
```

Final count:

```text
extractCount = limit === "all" ? possibleCount : min(limit, possibleCount)
```

### 5. Extract frames

By time:

```bash
ffmpeg -hide_banner -loglevel error \
  -i video.mp4 \
  -vf "fps=1/$INTERVAL" \
  -frames:v "$EXTRACT_COUNT" \
  -q:v 2 \
  frames/frame_%04d.jpg
```

If `interval=all` for time, use `INTERVAL=1`.

By frame:

```bash
ffmpeg -hide_banner -loglevel error \
  -i video.mp4 \
  -vf "select='not(mod(n,$INTERVAL))'" \
  -vsync vfr \
  -frames:v "$EXTRACT_COUNT" \
  -q:v 2 \
  frames/frame_%04d.jpg
```

If `interval=all` for frame, use `INTERVAL=1`.

### 6. Upload frames

Create Google Drive child folder under fixed parent.

Upload each jpg.

For UI display, generate direct-ish links. One option:

```text
preview url:  https://drive.google.com/uc?export=view&id=FILE_ID
download url: https://drive.google.com/uc?export=download&id=FILE_ID
```

If Drive blocks image hotlinking, proxy image files through Next.js/n8n or use Google Drive thumbnail links.

### 7. Create Download All zip

```bash
cd frames
zip -r ../all_frames.zip .
```

Upload `all_frames.zip` to the same Google Drive child folder. Return ZIP download URL in `zipUrl`.

### 8. Delete local video and temp files

This is mandatory.

```bash
rm -f /work/tmp/frame-extractor/$JOB_ID/video.mp4
rm -rf /work/tmp/frame-extractor/$JOB_ID
```

Use a cleanup node in both success and error branches.

Important: delete only the job temp directory, never a broad shared path.

## YouTube support phase 2

Phase 1 should support Google Drive video links.

For YouTube later, add a branch:

```bash
yt-dlp --cookies /data/youtube-cookies.txt \
  --js-runtimes node:/usr/bin/node \
  -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best" \
  --merge-output-format mp4 \
  -o "$JOB_DIR/video.%(ext)s" \
  "$VIDEO_URL"
```

If VPS IP is blocked, use a residential proxy or local n8n worker.
