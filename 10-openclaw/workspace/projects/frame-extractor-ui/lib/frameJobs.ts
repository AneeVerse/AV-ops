import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ExtractMode = "time" | "frame";
export type JobStatus = "queued" | "processing" | "done" | "failed";

export type FrameImage = {
  id: string;
  name: string;
  url: string;
  downloadUrl: string;
  driveFileId: string;
  timestamp?: number;
  frameNumber?: number;
};

export type FrameJob = {
  id: string;
  name: string;
  videoUrl: string;
  mode: ExtractMode;
  interval: number | "all";
  limit: number | "all";
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  outputDriveFolderId: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  zipUrl?: string;
  zipFileId?: string;
  possibleCount?: number;
  images: FrameImage[];
  error?: string | null;
};

type StartInput = {
  videoUrl: string;
  name?: string;
  mode: ExtractMode;
  interval: number | "all";
  limit: number | "all";
  outputDriveFolderId: string;
};

type DriveGet = {
  file?: {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    webViewLink?: string;
  };
};

type DriveFolder = {
  folder?: { id: string; name: string; webViewLink?: string };
  file?: { id: string; name: string; webViewLink?: string };
  id?: string;
  webViewLink?: string;
};

type DriveUpload = {
  file?: { id: string; name: string; webViewLink?: string };
  id?: string;
  name?: string;
  webViewLink?: string;
};

type Probe = {
  streams?: Array<{ avg_frame_rate?: string; nb_frames?: string; duration?: string }>;
  format?: { duration?: string; size?: string };
};

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const TMP_ROOT = path.join("/tmp", "frame-extractor-ui");
const DEFAULT_PARENT = "128VtgRTZhfYvZkD13LWWYKw5vmRw7aKN";
const runningJobs = new Set<string>();

async function ensureData() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(TMP_ROOT, { recursive: true });
}

async function run(bin: string, args: string[], opts: { cwd?: string; timeout?: number } = {}) {
  const { stdout, stderr } = await execFileAsync(bin, args, {
    cwd: opts.cwd,
    timeout: opts.timeout ?? 1000 * 60 * 15,
    maxBuffer: 1024 * 1024 * 20,
  });
  return { stdout, stderr };
}

function parseJson<T>(text: string): T {
  return JSON.parse(text.trim() || "{}");
}

function safeName(input: string) {
  return input
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[\\/:*?"<>|#%{}$!'@+`=]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90) || "Video frames";
}

function stamp() {
  return new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
}

function parseDriveId(urlOrId: string) {
  const trimmed = urlOrId.trim();
  const fileMatch = trimmed.match(/\/file\/d\/([^/]+)/);
  if (fileMatch) return fileMatch[1];
  const idMatch = trimmed.match(/[?&]id=([^&]+)/);
  if (idMatch) return idMatch[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  throw new Error("Only Google Drive file links are supported in this version.");
}

function parseRate(rate?: string) {
  if (!rate || rate === "0/0") return 0;
  const [a, b] = rate.split("/").map(Number);
  if (!b) return a || 0;
  return a / b;
}

async function loadJobs(): Promise<FrameJob[]> {
  await ensureData();
  try {
    const raw = await readFile(HISTORY_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveJobs(jobs: FrameJob[]) {
  await ensureData();
  await writeFile(HISTORY_FILE, JSON.stringify(jobs, null, 2));
}

async function upsertJob(job: FrameJob) {
  const jobs = await loadJobs();
  const next = [job, ...jobs.filter((item) => item.id !== job.id)];
  await saveJobs(next);
}

export async function listJobs() {
  return loadJobs();
}

export async function getJob(jobId: string) {
  const jobs = await loadJobs();
  return jobs.find((job) => job.id === jobId) || null;
}

export async function renameJob(jobId: string, name: string) {
  const jobs = await loadJobs();
  const job = jobs.find((item) => item.id === jobId);
  if (!job) return null;
  job.name = safeName(name);
  job.updatedAt = new Date().toISOString();
  await saveJobs(jobs);
  if (job.driveFolderId) {
    run("gog", ["drive", "rename", job.driveFolderId, job.name]).catch(() => undefined);
  }
  return job;
}

export async function deleteJob(jobId: string) {
  const jobs = await loadJobs();
  const job = jobs.find((item) => item.id === jobId);
  if (!job) return null;
  if (runningJobs.has(jobId) || job.status === "queued" || job.status === "processing") {
    throw new Error("This job is still processing. Wait until it finishes before deleting it.");
  }
  await saveJobs(jobs.filter((item) => item.id !== jobId));
  return job;
}

export async function createJob(input: StartInput) {
  if (!input.videoUrl?.trim()) throw new Error("videoUrl is required");
  if (input.mode !== "time" && input.mode !== "frame") throw new Error("mode must be time or frame");
  const job: FrameJob = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: safeName(input.name || "Processing video"),
    videoUrl: input.videoUrl.trim(),
    mode: input.mode,
    interval: input.interval === "all" ? "all" : Math.max(1, Number(input.interval || 1)),
    limit: input.limit === "all" ? "all" : Math.max(1, Number(input.limit || 1)),
    status: "queued",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    outputDriveFolderId: input.outputDriveFolderId || DEFAULT_PARENT,
    images: [],
    error: null,
  };
  await upsertJob(job);
  process.nextTick(() => processJob(job.id).catch(() => undefined));
  return job;
}

async function processJob(jobId: string) {
  if (runningJobs.has(jobId)) return;
  runningJobs.add(jobId);
  let job = await getJob(jobId);
  if (!job) return;

  const jobDir = path.join(TMP_ROOT, job.id);
  const framesDir = path.join(jobDir, "frames");
  const videoPath = path.join(jobDir, "video.mp4");
  const zipPath = path.join(jobDir, "all_frames.zip");

  try {
    job.status = "processing";
    job.updatedAt = new Date().toISOString();
    await upsertJob(job);

    await rm(jobDir, { recursive: true, force: true });
    await mkdir(framesDir, { recursive: true });

    const driveId = parseDriveId(job.videoUrl);
    const meta = parseJson<DriveGet>((await run("gog", ["drive", "get", driveId, "--json"])).stdout);
    const videoName = meta.file?.name ? safeName(meta.file.name) : "Video frames";
    if (job.name === "Processing video") job.name = videoName;

    await run("gog", ["drive", "download", driveId, "--out", videoPath], { timeout: 1000 * 60 * 20 });

    const probe = parseJson<Probe>((await run("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=avg_frame_rate,nb_frames,duration",
      "-show_entries", "format=duration,size",
      "-of", "json",
      videoPath,
    ])).stdout);

    const stream = probe.streams?.[0] || {};
    const duration = Number(stream.duration || probe.format?.duration || 0);
    const fps = parseRate(stream.avg_frame_rate) || 30;
    const totalFrames = Number(stream.nb_frames || 0) || Math.ceil(duration * fps);
    const actualInterval = job.interval === "all" ? 1 : Number(job.interval);
    const possibleCount = job.mode === "time"
      ? Math.max(1, Math.floor(duration / actualInterval) + 1)
      : Math.max(1, Math.ceil(totalFrames / actualInterval));
    const extractCount = job.limit === "all" ? possibleCount : Math.min(Number(job.limit), possibleCount);
    job.possibleCount = possibleCount;

    const ffmpegArgs = job.mode === "time"
      ? ["-hide_banner", "-loglevel", "error", "-i", videoPath, "-vf", `fps=1/${actualInterval}`, "-frames:v", String(extractCount), "-q:v", "2", path.join(framesDir, "frame_%04d.jpg")]
      : ["-hide_banner", "-loglevel", "error", "-i", videoPath, "-vf", `select='not(mod(n,${actualInterval}))'`, "-vsync", "vfr", "-frames:v", String(extractCount), "-q:v", "2", path.join(framesDir, "frame_%04d.jpg")];
    await run("ffmpeg", ffmpegArgs, { timeout: 1000 * 60 * 30 });

    const folderName = safeName(`${job.name} - ${stamp()}`);
    const folder = parseJson<DriveFolder>((await run("gog", ["drive", "mkdir", folderName, "--parent", job.outputDriveFolderId, "--json"])).stdout);
    const folderInfo = folder.folder || folder.file || folder;
    job.driveFolderId = folderInfo.id;
    job.driveFolderUrl = folderInfo.webViewLink || (job.driveFolderId ? `https://drive.google.com/drive/folders/${job.driveFolderId}` : undefined);
    if (!job.driveFolderId) throw new Error("Could not create Google Drive output folder");

    const frameFiles = (await readdir(framesDir)).filter((file) => file.endsWith(".jpg")).sort();
    const images: FrameImage[] = [];
    for (const file of frameFiles) {
      const uploaded = parseJson<DriveUpload>((await run("gog", ["drive", "upload", path.join(framesDir, file), "--parent", job.driveFolderId, "--name", file, "--json", "--no-input"], { timeout: 1000 * 60 * 10 })).stdout);
      const info = uploaded.file || uploaded;
      const fileId = info.id || "";
      if (!fileId) continue;
      images.push({
        id: file.replace(/\.jpg$/, ""),
        name: file,
        driveFileId: fileId,
        url: `https://drive.google.com/uc?export=view&id=${fileId}`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
      });
      job.images = images;
      job.updatedAt = new Date().toISOString();
      await upsertJob(job);
    }

    await run("python3", ["-c", "import os, zipfile, sys\nframes=sys.argv[1]; out=sys.argv[2]\nwith zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:\n    for name in sorted(os.listdir(frames)):\n        if name.endswith('.jpg'):\n            z.write(os.path.join(frames, name), name)", framesDir, zipPath], { timeout: 1000 * 60 * 10 });
    const zipUpload = parseJson<DriveUpload>((await run("gog", ["drive", "upload", zipPath, "--parent", job.driveFolderId, "--name", "all_frames.zip", "--json", "--no-input"], { timeout: 1000 * 60 * 10 })).stdout);
    const zipInfo = zipUpload.file || zipUpload;
    if (zipInfo.id) {
      job.zipFileId = zipInfo.id;
      job.zipUrl = `https://drive.google.com/uc?export=download&id=${zipInfo.id}`;
    }

    await run("gog", ["drive", "share", job.driveFolderId, "--to", "anyone", "--role", "reader", "--json", "--no-input", "--force"]).catch(() => ({ stdout: "", stderr: "" }));

    job.status = "done";
    job.updatedAt = new Date().toISOString();
    job.error = null;
    await upsertJob(job);
  } catch (err) {
    job = (await getJob(jobId)) || job;
    job.status = "failed";
    job.error = err instanceof Error ? err.message : String(err);
    job.updatedAt = new Date().toISOString();
    await upsertJob(job);
  } finally {
    await rm(jobDir, { recursive: true, force: true });
    runningJobs.delete(jobId);
  }
}
