"use client";

import { FormEvent, useRef, useState, useEffect } from "react";

const DEFAULT_PROMPT =
  "Copy the ring in the attached image exactly as it is — same angle, same position, same tilt, same orientation, same lighting on the metal, same reflections. Do not change, rotate, resize, or reinterpret the ring in any way.\nOnly change the background and surface: place the ring on a smooth natural stone/rock surface, in a natural garden setting in Central Park, New York City, with soft blurred green foliage, trees, and a hint of a stone pathway in the background (bokeh).\nLighting: natural sunlight only, warm and soft, golden hour style — no studio lighting, no flash, realistic outdoor shadows and highlights.\nCamera: high-end professional camera (Canon EOS R5 or Sony A7R V style), macro lens (100mm), shallow depth of field, ultra-sharp focus on the ring.\nStyle: fully photorealistic, natural stone texture, no artificial glow or retouching.\nImage specifications: square format, 2000 x 2000 pixels, high resolution.\nThe ring itself must remain 100% unchanged from the attached image — only the background and surface are replaced.";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const STORAGE_KEY = "jwel-img-gen-prompt";

type ApiResult = Record<string, unknown> | null;
type Mode = "single" | "batch";
type EditMode = "view" | "edit";

function downloadImage(url: string, filename: string) {
  fetch(url, { mode: "cors" })
    .then((r) => r.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || "generated-image.jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    })
    .catch(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
}

function ResultPanel({ result }: { result: ApiResult }) {
  if (!result) return null;

  const success = Boolean(result.success);
  const imageUrl = result.replicate_image_url as string | undefined;
  const singleLink = result.drive_link as string | undefined;
  const folderLink = result.output_folder_link as string | undefined;
  const driveName = result.drive_name as string | undefined;
  const previewUrl = result.preview_url as string | undefined;
  const durationSeconds = typeof result.duration_seconds === "number" ? result.duration_seconds : null;
  const estimatedCost = typeof result.estimated_cost_usd === "number" ? result.estimated_cost_usd : null;
  const model = (result.model as string | undefined) || "nano-banana";
  const status = (result.status as string | undefined) || (success ? "succeeded" : "failed");
  const predictionId = (result.replicate_prediction_id as string | undefined) || "";

  const summaryLine = [
    status === "succeeded" ? "Generation succeeded" : `Generation ${status}`,
    durationSeconds !== null ? `${durationSeconds}s` : null,
    estimatedCost !== null ? `~$${estimatedCost.toFixed(3)}` : null,
    model ? `model: ${model}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-5 space-y-4">
      <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${success ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-black">{success ? "Completed successfully." : "Workflow returned a response."}</span>
        </div>
        <div className="mt-1 text-xs text-slate-300">{summaryLine || "No metadata."}</div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex">
        {previewUrl || imageUrl ? (
          <button
            type="button"
            onClick={() => downloadImage(imageUrl || previewUrl || "", driveName || "generated-image.jpg")}
            className="rounded-xl bg-white px-4 py-2 text-sm font-black text-black transition hover:bg-slate-200"
          >
            Download image
          </button>
        ) : null}
        {singleLink ? (
          <a href={singleLink} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-700/70 bg-[#12151b] px-4 py-2 text-sm font-black text-slate-200 transition hover:border-slate-500/80 hover:text-white">Open in Drive</a>
        ) : null}
        {folderLink ? (
          <a href={folderLink} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-700/70 bg-[#12151b] px-4 py-2 text-sm font-black text-slate-200 transition hover:border-slate-500/80 hover:text-white">Open output folder</a>
        ) : null}
      </div>

      {(previewUrl || imageUrl) && previewUrl !== imageUrl ? (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {previewUrl ? (
            <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-[#07080b]">
              <div className="px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Before</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Reference preview" className="max-h-[360px] w-full object-contain" />
            </div>
          ) : null}
          {imageUrl ? (
            <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-[#07080b]">
              <div className="px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">After</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Generated result" className="max-h-[360px] w-full object-contain" />
            </div>
          ) : null}
        </div>
      ) : (
        imageUrl && (
          <div className="mb-4 overflow-hidden rounded-2xl border border-slate-700/70 bg-[#07080b]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Generated result" className="max-h-[520px] w-full object-contain" />
          </div>
        )
      )}

      <details className="group">
        <summary className="cursor-pointer list-none rounded-xl border border-slate-700/70 bg-[#090b0f] px-4 py-2 text-sm font-black uppercase tracking-[0.24em] text-slate-300 transition hover:border-slate-500/60">
          <span className="mr-2 inline-block transition group-open:rotate-180">▾</span>
          Result details
          {predictionId ? <span className="ml-2 text-slate-500">#{predictionId.slice(0, 8)}</span> : null}
        </summary>
        <pre className="mt-3 max-h-80 overflow-auto rounded-2xl border border-slate-700/70 bg-[#07080b] p-4 text-xs leading-6 text-slate-300">{JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  );
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [editMode, setEditMode] = useState<EditMode>("view");
  const [draft, setDraft] = useState<string>(prompt);
  const [folderUrl, setFolderUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const apiBase = useRef<string>(
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname.replace(/\/$/, "")}/`
      : "/"
  ).current;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setPrompt(stored);
        setDraft(stored);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, prompt);
    } catch {
      // ignore storage errors
    }
  }, [prompt]);

  function selectFile(file: File | null) {
    setResult(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!file) {
      setSingleFile(null);
      setPreviewUrl(null);
      setError(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setSingleFile(null);
      setPreviewUrl(null);
      setError("Please choose a JPG, PNG, or WEBP image.");
      return;
    }
    setError(null);
    setSingleFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setEditMode("view");
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setResult(null);
    setError(null);
  }

  async function submitSingle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!singleFile) {
      setError("Choose a reference image before generating.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const form = new FormData();
      form.append("image", singleFile);
      form.append("prompt", prompt);
      const response = await fetch(`${apiBase}api/single/`, { method: "POST", body: form });
      const data = await response.json();
      setResult(data);
      if (!response.ok || data?.success === false) setError(String(data?.error || "Generation failed."));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function submitBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!folderUrl.trim()) {
      setError("Paste a Google Drive folder link before processing.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${apiBase}api/batch/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input_folder_url: folderUrl, prompt }),
      });
      const data = await response.json();
      setResult(data);
      if (!response.ok || data?.success === false) {
        const emptyFolder = data?.total_images_found === 0;
        setError(String(data?.error || (emptyFolder ? "No images were found in that Drive folder." : "Folder processing returned a warning.")));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Folder processing failed.");
    } finally {
      setLoading(false);
    }
  }

  const fieldClasses = "w-full resize-none rounded-2xl border border-slate-700/70 bg-[#080a0e] px-4 py-3 text-sm text-[#c5c9d1] outline-none transition placeholder:text-slate-500 focus:border-slate-400/80 focus:ring-2 focus:ring-slate-400/10";
  const activeTab = "bg-white text-black shadow-lg shadow-black/20";
  const inactiveTab = "text-slate-400 hover:bg-slate-800/50 hover:text-white";
  const activeButton = "bg-white text-black hover:bg-slate-200 shadow-lg shadow-black/30";
  const disabledButton = "bg-slate-700/45 text-slate-500 opacity-40 grayscale cursor-not-allowed";

  return (
    <main className="min-h-screen bg-[#050607] px-4 py-5 text-white sm:px-5 sm:py-6">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[32px] border border-slate-700/70 bg-[#12151b] shadow-2xl shadow-black/50">
        <header className="border-b border-slate-700/70 bg-[#090b0f] px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-2xl text-black">✦</div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Jewelry image generator</h1>
              <p className="mt-1 text-sm leading-snug text-slate-400 sm:text-base">Upload a reference image or Google Drive folder to generate a premium product photo.</p>
            </div>
          </div>
        </header>

        <section className="p-5 sm:p-6">
          <div className="mb-4 grid grid-cols-2 rounded-2xl border border-slate-700/70 bg-[#07080b] p-1.5">
            <button type="button" onClick={() => switchMode("single")} className={`relative rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wide transition ${mode === "single" ? activeTab : inactiveTab}`}>Single Image</button>
            <button type="button" onClick={() => switchMode("batch")} className={`relative rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wide transition ${mode === "batch" ? activeTab : inactiveTab}`}>Drive Folder</button>
          </div>

          <div className="mb-4 rounded-2xl border border-slate-700/70 bg-[#0a0c12] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm text-slate-300">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Prompt</div>
                <div className="mt-1 line-clamp-2 text-[13px] leading-snug text-slate-300" spellCheck={false}>{prompt}</div>
              </div>
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => { setDraft(prompt); setEditMode("edit"); }}
                  className="rounded-xl border border-slate-700/70 bg-[#12151b] px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:border-slate-500/80 hover:text-white"
                  title="Edit prompt"
                >
                  <span className="mr-1 align-middle">✎</span> Edit
                </button>
              </div>
            </div>

            {editMode === "edit" ? (
              <div className="mt-3 rounded-2xl border border-slate-700/70 bg-[#080a0e] p-2">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.24em] text-slate-400">Edit prompt</label>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={5}
                  className={fieldClasses}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => { setPrompt(draft); setEditMode("view"); }} className="rounded-xl bg-white px-4 py-2 text-xs font-black text-black transition hover:bg-slate-200">Save</button>
                  <button type="button" onClick={() => { setDraft(prompt); setEditMode("view"); }} className="rounded-xl border border-slate-700/70 px-4 py-2 text-xs font-black text-slate-300 transition hover:text-white">Cancel</button>
                </div>
              </div>
            ) : null}
          </div>

          {error ? <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
          {loading ? <div className="mb-4 rounded-2xl border border-slate-400/20 bg-slate-500/10 px-4 py-3 text-sm text-slate-200">Processing through n8n. This can take a few seconds...</div> : null}

          {mode === "single" ? (
            <form onSubmit={submitSingle} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.24em] text-slate-400">Reference image</label>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} className="hidden" />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click(); }}
                  onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(event) => { event.preventDefault(); setDragActive(false); selectFile(event.dataTransfer.files?.[0] ?? null); }}
                  className={`min-h-[140px] rounded-2xl border border-dashed p-4 transition sm:p-5 ${dragActive ? "border-slate-400 bg-slate-400/10" : "border-slate-600/60 bg-[#080a0e] hover:border-slate-500/80 hover:bg-slate-500/[0.06]"}`}
                >
                  {previewUrl ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="Selected jewelry reference preview" className="h-40 w-40 rounded-2xl object-cover" />
                      <div className="min-w-0 text-sm">
                        <div className="truncate font-black text-[#c5c9d1]">{singleFile?.name}</div>
                        <div className="mt-1 text-slate-500">{singleFile ? `${Math.round(singleFile.size / 1024)} KB` : ""}</div>
                        <div className="mt-3">
                          <button type="button" onClick={() => selectFile(null)} className="rounded-xl border border-slate-700/70 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-300 transition hover:text-white">Change image</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1.5 py-1 text-center">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-xl text-black">▧</div>
                      <div className="font-black text-[#c5c9d1]">Tap to choose a photo</div>
                      <div className="text-xs text-slate-500">JPG, PNG, or WEBP</div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <button type="submit" disabled={loading || !singleFile} className={`w-full rounded-2xl px-5 py-4 text-base font-black transition ${loading || !singleFile ? disabledButton : activeButton}`}>{loading ? "Generating..." : "Generate image"}</button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitBatch} className="space-y-4">
              <div>
                <label htmlFor="folder" className="mb-2 block text-xs font-black uppercase tracking-[0.24em] text-slate-400">Input Google Drive folder link</label>
                <input id="folder" value={folderUrl} onChange={(event) => setFolderUrl(event.target.value)} placeholder="https://drive.google.com/drive/folders/..." required className={fieldClasses.replace("resize-none ", "")} />
              </div>

              <div>
                <button type="submit" disabled={loading || !folderUrl} className={`w-full rounded-2xl px-5 py-4 text-base font-black transition ${loading || !folderUrl ? disabledButton : activeButton}`}>{loading ? "Processing..." : "Process folder"}</button>
              </div>
            </form>
          )}

          <ResultPanel result={result} />
        </section>
      </div>
    </main>
  );
}
