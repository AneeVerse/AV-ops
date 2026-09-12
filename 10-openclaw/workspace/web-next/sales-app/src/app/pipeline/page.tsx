"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SalesShell } from "@/components/sales-shell";
import { salesFetch, titleize } from "@/lib/api";

type PipelineItem = {
  id: number;
  company_name?: string;
  niche?: string;
  contact_person?: string;
  next_action?: string;
  status?: string;
};

type PipelineResponse = { items?: PipelineItem[] };

const stages = [
  "new",
  "researched",
  "contacted",
  "follow-up",
  "interested",
  "meeting booked",
  "closed won",
  "closed lost",
  "no response",
];

function badgeClass(stage = "") {
  const raw = stage.toLowerCase();
  if (raw.includes("lost")) return "bg-red-400/15 text-red-200";
  if (raw.includes("follow") || raw.includes("response")) return "bg-amber-400/15 text-amber-200";
  if (raw.includes("won") || raw.includes("meeting") || raw.includes("interested")) return "bg-emerald-400/15 text-emerald-200";
  return "bg-white/6 text-zinc-300";
}

function PipelinePageInner() {
  const params = useSearchParams();
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearch(params.get("q_text") || "");
    setStatus(params.get("status") || "");
  }, [params]);

  useEffect(() => {
    salesFetch<PipelineResponse>("/pipeline")
      .then((res) => setItems(res.items ?? []))
      .catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const hay = [item.company_name, item.contact_person, item.next_action, item.niche]
        .join(" ")
        .toLowerCase();
      const qOk = !search || hay.includes(search.toLowerCase());
      const sOk = !status || (item.status || "").toLowerCase() === status.toLowerCase();
      return qOk && sOk;
    });
  }, [items, search, status]);

  return (
    <SalesShell title="Pipeline" subtitle="Move leads cleanly across stages.">
      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_10px_30px_rgba(0,0,0,.24)]">
        <div className="mb-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[#b7f7e6]">
          Stage control
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Update lead status without a bloated board.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--muted)]">
          Search, filter, and review stalled leads quickly. Writable card updates migrate next after page parity.
        </p>
      </section>

      {error ? (
        <div className="rounded-[var(--radius)] border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[#17191f] px-3 py-2.5 outline-none"
            placeholder="Search company, contact, next action"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[#17191f] px-3 py-2.5 outline-none"
          >
            <option value="">All lanes</option>
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {titleize(stage)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="overflow-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="grid min-w-max grid-cols-9 gap-3">
          {stages.map((stage) => {
            const group = filtered.filter((item) => (item.status || "").toLowerCase() === stage);
            return (
              <div key={stage} className="grid min-h-[260px] content-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass(stage)}`}>{titleize(stage)}</span>
                  <span className="text-xs text-[var(--muted)]">{group.length}</span>
                </div>

                {group.length ? (
                  group.map((item) => (
                    <Link key={item.id} href={`/leads/detail?id=${item.id}`} className="grid gap-2 rounded-2xl border border-[var(--border)] bg-[#17191f] p-3 hover:border-white/20">
                      <div className="text-sm font-semibold leading-5">{item.company_name || "Untitled lead"}</div>
                      <div className="grid gap-1 text-xs text-[var(--muted)]">
                        <span>{item.niche || "No niche"}</span>
                        <span>{item.contact_person || "No contact name"}</span>
                      </div>
                      <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] px-3 py-2 text-xs text-[var(--muted)]">
                        {item.next_action || "No next action"}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-sm text-[var(--muted)]">No leads in this stage.</div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </SalesShell>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)] p-6 text-sm text-[var(--muted)]">Loading pipeline...</div>}>
      <PipelinePageInner />
    </Suspense>
  );
}
