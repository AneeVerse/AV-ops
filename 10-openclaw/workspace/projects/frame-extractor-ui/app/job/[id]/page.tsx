"use client";

import { ArrowLeft, Download, Images, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type ExtractMode = "time" | "frame";
type JobStatus = "queued" | "processing" | "done" | "failed";

type FrameImage = {
  id: string;
  name: string;
  url: string;
  downloadUrl?: string;
  driveFileId?: string;
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
  updatedAt?: string;
  driveFolderUrl?: string;
  zipUrl?: string;
  images: FrameImage[];
  possibleCount?: number;
  error?: string;
};

function imageProxyUrl(img: FrameImage, download = false) {
  if (!img.driveFileId) return download ? img.downloadUrl || img.url : img.url;
  const params = new URLSearchParams({ id: img.driveFileId, name: img.name || "frame.jpg" });
  if (download) params.set("download", "1");
  return `/api/frame-extractor/image?${params.toString()}`;
}

export default function JobDetailsPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const [job, setJob] = useState<HistoryJob | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadJob() {
    try {
      setError("");
      const res = await fetch(`/api/frame-extractor/status?jobId=${encodeURIComponent(jobId)}`);
      if (!res.ok) throw new Error(`Could not load job: ${res.status}`);
      const data: HistoryJob = await res.json();
      setJob(data);
      setName(data.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load generation.");
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    if (!job || !name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/frame-extractor/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, name: name.trim() }),
      });
      if (!res.ok) throw new Error(`Rename failed: ${res.status}`);
      await loadJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    if (!job || job.status === "done" || job.status === "failed") return;
    const timer = window.setInterval(loadJob, 2500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  return (
    <main className="app-shell detail-shell">
      <aside className="sidebar detail-sidebar">
        <Link className="side-link" href="/?tab=history"><ArrowLeft size={18} /> Back</Link>
        <div className="detail-side-title">
          <span className="pill">{job?.status || "loading"}</span>
          <h1>{job?.name || "Generation details"}</h1>
          {job && <p>{job.images.length} images extracted</p>}
        </div>

        {job && (
          <>
            <div className="detail-actions side-actions">
              {job.zipUrl && <a className="primary detail-primary" href={job.zipUrl} download><Download size={17} /> Download all</a>}
              {job.driveFolderUrl && <a className="secondary side-secondary" href={job.driveFolderUrl} target="_blank"><Images size={16} /> See Drive</a>}
            </div>

            <div className="side-panel">
              <label className="label" htmlFor="generation-name">Change name</label>
              <input id="generation-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Generation name" />
              <button className="secondary side-save" onClick={saveName} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save name</button>
            </div>

            <div className="side-details">
              <div><strong>Created</strong><span>{new Date(job.createdAt).toLocaleString()}</span></div>
              <div><strong>Mode</strong><span>{job.mode === "time" ? "By time" : "By frame"}</span></div>
              <div><strong>Interval</strong><span>{String(job.interval)}</span></div>
              <div><strong>Possible count</strong><span>{job.possibleCount ?? job.images.length}</span></div>
              <div><strong>Source</strong><span>{job.videoUrl}</span></div>
            </div>
          </>
        )}
      </aside>

      <section className="app-main detail-main">
        {loading ? (
          <section className="card"><div className="empty"><Loader2 className="spin" size={34} /><p>Loading generation...</p></div></section>
        ) : error ? (
          <section className="card"><div className="status error">{error}</div></section>
        ) : job ? (
          job.status === "processing" || job.status === "queued" ? (
            <section className="card"><div className="empty"><Loader2 className="spin" size={34} /><p>Processing. Images will appear here automatically.</p></div></section>
          ) : (
            <section className="images-panel">
              <div className="gallery-head images-panel-head">
                <div>
                  <h2>All images</h2>
                  <div className="help">Click individual download buttons to save one image.</div>
                </div>
              </div>
              <div className="gallery large-gallery wide-gallery">
                {job.images.map((img, index) => (
                  <article className="frame" key={img.id || img.url}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageProxyUrl(img)} alt={img.name || `Frame ${index + 1}`} />
                    <div className="frame-meta">
                      <span>{img.name || `Frame ${index + 1}`}</span>
                      <a className="secondary" href={imageProxyUrl(img, true)} download><Download size={14} /></a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )
        ) : null}
      </section>
    </main>
  );
}
