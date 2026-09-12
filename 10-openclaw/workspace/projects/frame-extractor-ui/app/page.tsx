"use client";

import { Clock, Download, GalleryHorizontal, History, Images, Loader2, Play, Trash2, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ExtractMode = "time" | "frame";
type JobStatus = "queued" | "processing" | "done" | "failed";

type FrameImage = {
  id: string;
  name: string;
  url: string;
  downloadUrl?: string;
  driveFileId?: string;
  timestamp?: number;
  frameNumber?: number;
};

type HistoryJob = {
  id: string;
  name: string;
  videoUrl: string;
  mode: ExtractMode;
  interval: number | "all";
  limit: number | "all";
  status: JobStatus;
  createdAt: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  zipUrl?: string;
  images: FrameImage[];
  possibleCount?: number;
  error?: string;
};

type StartResponse = {
  jobId: string;
  status: JobStatus;
  name?: string;
  possibleCount?: number;
  message?: string;
};

type StatusResponse = HistoryJob;

const N8N_BASE_URL = process.env.NEXT_PUBLIC_N8N_BASE_URL || "";
const HISTORY_KEY = "frame-extractor-history-v1";

function endpoint(path: string) {
  if (!N8N_BASE_URL) return path;
  return `${N8N_BASE_URL.replace(/\/$/, "")}${path}`;
}

function apiPath(name: "start" | "status" | "history" | "rename" | "metadata" | "delete") {
  return N8N_BASE_URL ? `/webhook/frame-extractor/${name}` : `/api/frame-extractor/${name}`;
}

function directDownload(url: string) {
  return url.includes("?") ? `${url}&download=1` : `${url}?download=1`;
}

function imageProxyUrl(img: FrameImage, download = false) {
  if (!img.driveFileId) return download ? img.downloadUrl || directDownload(img.url) : img.url;
  const params = new URLSearchParams({ id: img.driveFileId, name: img.name || "frame.jpg" });
  if (download) params.set("download", "1");
  return `/api/frame-extractor/image?${params.toString()}`;
}

function zipReady(job: HistoryJob) {
  return Boolean(job.zipUrl);
}

function imageCountText(job: HistoryJob) {
  const actual = job.images.length;
  if (job.status === "done" || job.status === "failed" || !job.possibleCount) return `${actual} images`;
  return `${actual}/${job.possibleCount} images`;
}

function loadLocalHistory(): HistoryJob[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalHistory(jobs: HistoryJob[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(jobs));
}

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<"extract" | "history">("extract");
  const [flowStep, setFlowStep] = useState<1 | 2>(1);
  const [videoUrl, setVideoUrl] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<ExtractMode>("time");
  const [interval, setIntervalValue] = useState("5");
  const [intervalAll, setIntervalAll] = useState(false);
  const [activeJob, setActiveJob] = useState<HistoryJob | null>(null);
  const [history, setHistory] = useState<HistoryJob[]>(() => loadLocalHistory());
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  const currentInterval: number | "all" = intervalAll ? "all" : Math.max(1, Number(interval || 1));
  const currentLimit: number | "all" = "all";

  const intervalHelp = useMemo(() => {
    if (mode === "time") return "Example: 5 means one screenshot every 5 seconds. All means every 1 second.";
    return "Example: 5 means every 5th frame. All means every frame, which can create a huge number of images.";
  }, [mode]);

  const refreshHistory = useCallback(async (fallback?: HistoryJob[]) => {
    const fallbackJobs = fallback ?? loadLocalHistory();
    try {
      const res = await fetch(endpoint(apiPath("history")), { cache: "no-store" });
      if (!res.ok) throw new Error(`History request failed: ${res.status}`);
      const data = await res.json();
      const jobs = Array.isArray(data) ? data : data.jobs || [];
      setHistory(jobs);
      saveLocalHistory(jobs);
    } catch {
      setHistory(fallbackJobs);
    }
  }, []);

  async function pollJob(jobId: string) {
    try {
      const res = await fetch(endpoint(`${apiPath("status")}?jobId=${encodeURIComponent(jobId)}`));
      if (!res.ok) throw new Error(`Status request failed: ${res.status}`);
      const job: StatusResponse = await res.json();
      setActiveJob(job);
      setStatusText(job.status === "done" ? "Extraction complete." : `Status: ${job.status}`);
      setHistory((prev) => {
        const next = [job, ...prev.filter((item) => item.id !== job.id)];
        saveLocalHistory(next);
        return next;
      });
    } catch (err) {
      setStatusText(err instanceof Error ? err.message : "Could not fetch job status.");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "history" || window.location.hash === "#history") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab("history");
      refreshHistory();
    }
  }, [refreshHistory]);

  useEffect(() => {
    if (!activeJob || activeJob.status === "done" || activeJob.status === "failed") return;
    const timer = window.setInterval(() => pollJob(activeJob.id), 2500);
    return () => window.clearInterval(timer);
  }, [activeJob]);

  async function goNext() {
    setError("");
    setStatusText("");
    if (!videoUrl.trim()) {
      setError("Add a video link first.");
      return;
    }
    setIsLoadingMeta(true);
    try {
      const res = await fetch(endpoint(apiPath("metadata")), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoUrl.trim() }),
      });
      if (!res.ok) throw new Error(`Could not read file name: ${res.status}`);
      const data = await res.json();
      setName(data.extractName || data.name || "Video frames");
      setFlowStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read video metadata.");
    } finally {
      setIsLoadingMeta(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setStatusText("");
    if (!videoUrl.trim()) {
      setError("Add a video link first.");
      return;
    }
    const payload = {
      videoUrl: videoUrl.trim(),
      name: name.trim() || undefined,
      mode,
      interval: currentInterval,
      limit: currentLimit,
      outputDriveFolderId: "128VtgRTZhfYvZkD13LWWYKw5vmRw7aKN",
    };

    setIsSubmitting(true);
    try {
      const res = await fetch(endpoint(apiPath("start")), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Start request failed: ${res.status}`);
      const data: StartResponse = await res.json();
      const job: HistoryJob = {
        id: data.jobId,
        name: data.name || name || "Processing video",
        videoUrl,
        mode,
        interval: currentInterval,
        limit: currentLimit,
        status: data.status || "queued",
        createdAt: new Date().toISOString(),
        images: [],
        possibleCount: data.possibleCount,
      };
      setActiveJob(job);
      setHistory((prev) => {
        const next = [job, ...prev.filter((item) => item.id !== job.id)];
        saveLocalHistory(next);
        return next;
      });
      setStatusText(data.message || "Job started. Processing video now...");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start extraction.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openJob(job: HistoryJob) {
    router.push(`/job/${job.id}`);
  }

  async function confirmDelete(jobId: string) {
    setDeletingJobId(jobId);
    setError("");
    try {
      const res = await fetch(endpoint(apiPath("delete")), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed: ${res.status}`);
      }
      setHistory((prev) => {
        const next = prev.filter((item) => item.id !== jobId);
        saveLocalHistory(next);
        return next;
      });
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete generation.");
    } finally {
      setDeletingJobId(null);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">FE</div>
          <div>
            <strong>Frame Extractor</strong>
            <span>Video screenshots</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          <button className={`side-link ${tab === "extract" ? "active" : ""}`} onClick={() => setTab("extract")}><Video size={18} /> Extract</button>
          <button className={`side-link ${tab === "history" ? "active" : ""}`} onClick={() => { setTab("history"); refreshHistory(); }}><History size={18} /> History</button>
        </nav>
      </aside>

      <section className="app-main">
      {tab === "extract" ? (
        <section className="extract-flow">
          <form className="card extractor-card" onSubmit={submit}>
            <div className="flow-steps polished-steps">
              <span className={`flow-step ${flowStep === 1 ? "active" : "done"}`}>1. Video link</span>
              <span className={`flow-step ${flowStep === 2 ? "active" : ""}`}>2. Settings</span>
            </div>

            {flowStep === 1 ? (
              <>
                <div className="flow-title">
                  <h2>Paste your video link</h2>
                  <p>Use a Google Drive video link. We’ll read the file name automatically in the next step.</p>
                </div>
                <div className="field">
                  <label className="label" htmlFor="videoUrl">Video link</label>
                  <input id="videoUrl" className="input big-input" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://drive.google.com/file/d/..." />
                </div>
                <button className="primary big-button" type="button" onClick={goNext} disabled={isLoadingMeta}>
                  {isLoadingMeta ? <Loader2 className="spin" size={18} /> : <Play size={18} />} Next
                </button>
              </>
            ) : (
              <>
                <div className="flow-title">
                  <h2>Confirm extraction settings</h2>
                  <p>Edit the name if needed, then choose how frames should be extracted.</p>
                </div>
                <div className="field">
                  <label className="label" htmlFor="name">Extract name</label>
                  <input id="name" className="input big-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto: video file name" />
                </div>
                <div className="field">
                  <span className="label">Extraction mode</span>
                  <div className="segment premium-segment">
                    <button type="button" className={mode === "time" ? "active" : ""} onClick={() => setMode("time")}><Clock size={16} /> By time</button>
                    <button type="button" className={mode === "frame" ? "active" : ""} onClick={() => setMode("frame")}><GalleryHorizontal size={16} /> By frame</button>
                  </div>
                </div>
                <div className="field">
                  <label className="label" htmlFor="interval">{mode === "time" ? "Seconds interval" : "Frame interval"}</label>
                  <div className="inline">
                    <input id="interval" className="input big-input" type="number" min="1" disabled={intervalAll} value={interval} onChange={(e) => setIntervalValue(e.target.value)} />
                    <label className="checkbox"><input type="checkbox" checked={intervalAll} onChange={(e) => setIntervalAll(e.target.checked)} /> All</label>
                  </div>
                  <div className="help">{intervalHelp}</div>
                </div>
                <div className="flow-actions">
                  <button className="secondary" type="button" onClick={() => setFlowStep(1)}>Back</button>
                  <button className="primary big-button" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="spin" size={18} /> : <Play size={18} />} Start extracting frames
                  </button>
                </div>
              </>
            )}
            {(statusText || error) && <div className={`status ${error ? "error" : ""}`}>{error || statusText}</div>}
          </form>

          {activeJob && (
            <section className={`result-card ${activeJob.status === "done" ? "success" : "processing"}`}>
              <div className="result-top">
                <div>
                  <span className="pill">{activeJob.status}</span>
                  <h2>{activeJob.name}</h2>
                  <p>{activeJob.status === "done" ? `${activeJob.images.length} images extracted successfully.` : "Processing your video. This may take a few minutes."}</p>
                </div>
                {(activeJob.status === "processing" || activeJob.status === "queued") && <Loader2 className="spin" size={28} />}
              </div>

              {activeJob.images.length > 0 && (
                <div className="result-preview-grid">
                  {activeJob.images.slice(0, 4).map((img, index) => (
                    <article className="frame" key={img.id || img.url}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageProxyUrl(img)} alt={img.name || `Frame ${index + 1}`} />
                    </article>
                  ))}
                </div>
              )}

              {activeJob.status === "done" && (
                <div className="result-actions">
                  {activeJob.zipUrl && <a className="primary detail-primary" href={activeJob.zipUrl} download><Download size={16} /> Download all</a>}
                  {activeJob.driveFolderUrl && <a className="secondary" href={activeJob.driveFolderUrl} target="_blank"><Images size={16} /> See Drive</a>}
                  <button className="secondary" type="button" onClick={() => openJob(activeJob)}>View all images</button>
                </div>
              )}
            </section>
          )}
        </section>
      ) : (
        <section className="history-panel">
          <div className="gallery-head history-panel-head">
            <div>
              <h2>History</h2>
              <div className="help">Previous generations. Click one to view its images.</div>
            </div>
            <button className="secondary" onClick={() => refreshHistory()}><History size={16} /> Refresh</button>
          </div>
          {error && <div className="status error">{error}</div>}
          <div className="history-grid">
            {history.length ? history.map((job) => {
              const cover = job.images[0];
              return (
                <article className="history-card" key={job.id} onClick={() => openJob(job)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openJob(job)}>
                  <div className="history-cover">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageProxyUrl(cover)} alt={job.name} />
                    ) : (
                      <div className="history-cover-empty"><Images size={34} /><span>No preview yet</span></div>
                    )}
                    <span className="history-badge">{job.status}</span>
                  </div>
                  <div className="history-body">
                    <div className="history-actions" onClick={(e) => e.stopPropagation()}>
                      {zipReady(job) ? <a className="secondary" href={job.zipUrl} download><Download size={15} /> ZIP ready</a> : <span className="help">ZIP not ready</span>}
                      {job.driveFolderUrl && <a className="secondary" href={job.driveFolderUrl} target="_blank"><Images size={15} /> See Drive</a>}
                      {confirmDeleteId === job.id ? (
                        <>
                          <button className="danger-button" type="button" onClick={() => confirmDelete(job.id)} disabled={deletingJobId === job.id}>
                            {deletingJobId === job.id ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />} Confirm delete
                          </button>
                          <button className="secondary icon-button" type="button" aria-label="Cancel delete" onClick={() => setConfirmDeleteId(null)}><X size={15} /></button>
                        </>
                      ) : (
                        <button className="secondary danger-text" type="button" onClick={() => setConfirmDeleteId(job.id)}><Trash2 size={15} /> Delete</button>
                      )}
                    </div>
                    <div className="help">{new Date(job.createdAt).toLocaleString()} · {job.mode === "time" ? "By time" : "By frame"} · interval {String(job.interval)} · {imageCountText(job)}</div>
                    <div className="history-title-row">
                      <h3>{job.name}</h3>
                    </div>
                  </div>
                </article>
              );
            }) : <div className="empty"><p>No history yet.</p></div>}
          </div>
        </section>
      )}
      </section>
    </main>
  );
}
