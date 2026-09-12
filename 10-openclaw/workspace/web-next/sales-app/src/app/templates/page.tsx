"use client";

import { useEffect, useState } from "react";
import { SalesShell } from "@/components/sales-shell";
import { salesFetch, titleize } from "@/lib/api";

type TemplateItem = {
  id: number;
  type?: string;
  niche?: string;
  name?: string;
  subject?: string;
  body?: string;
  call_script?: string;
  owner?: string;
  status?: string;
};

type TemplatesResponse = { items?: TemplateItem[] };

export default function TemplatesPage() {
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    salesFetch<TemplatesResponse>("/templates")
      .then((res) => setItems(res.items ?? []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <SalesShell title="Templates" subtitle="Reusable cold email, follow-up, WhatsApp, and call scripts.">
      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_10px_30px_rgba(0,0,0,.24)]">
        <div className="mb-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[#b7f7e6]">
          Template library
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Store reusable outreach instead of rewriting from scratch.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--muted)]">
          This page already has live read parity. Full create/edit form migration follows after route parity is complete.
        </p>
      </section>

      {error ? <div className="rounded-[var(--radius)] border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Create template</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">Form migration is next.</p>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">In progress</span>
          </div>
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/[0.02] p-4 text-sm leading-6 text-[var(--muted)]">
            The new Next.js library view is live first. Writable template CRUD comes next after all pages are migrated.
          </div>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Template library</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">Readable copy blocks instead of raw CRUD rows.</p>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">Reusable assets</span>
          </div>

          <div className="grid gap-3">
            {items.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[#b7f7e6]">{titleize(item.type || "template")}</span>
                  {item.niche ? <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">{item.niche}</span> : null}
                </div>
                <h3 className="text-lg font-semibold">{item.name || "Untitled template"}</h3>
                <div className="text-sm leading-6 text-[var(--muted)]">
                  <strong className="text-[var(--text)]">Subject:</strong> {item.subject || "No subject"}
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3 text-sm leading-6 text-[var(--text)] whitespace-pre-wrap">
                  {item.body || "No body"}
                </div>
                {item.call_script ? (
                  <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3 text-sm leading-6 text-[var(--text)] whitespace-pre-wrap">
                    <div className="mb-2 font-medium">Call script</div>
                    {item.call_script}
                  </div>
                ) : null}
                <div className="text-xs text-[var(--muted)]">Owner: {item.owner || "—"} • Status: {titleize(item.status || "active")}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SalesShell>
  );
}
