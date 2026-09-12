"use client";

import { useEffect, useState } from "react";
import { SalesShell } from "@/components/sales-shell";
import { salesFetch, titleize } from "@/lib/api";

type DraftItem = {
  id: number;
  lead_id?: number;
  company_name?: string;
  contact_person?: string;
  email?: string;
  channel?: string;
  subject?: string;
  owner?: string;
  created_at?: string;
  content?: string;
  outcome?: string;
};

type DraftResponse = { items?: DraftItem[] };

function badgeClass(outcome = "") {
  const raw = outcome.toLowerCase();
  if (raw.includes("reject")) return "bg-red-400/15 text-red-200";
  if (raw.includes("need")) return "bg-amber-400/15 text-amber-200";
  if (raw.includes("approve") || raw.includes("sent")) return "bg-emerald-400/15 text-emerald-200";
  return "bg-white/6 text-zinc-300";
}

function formatRelative(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(Math.abs(diffMs) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function ReviewPage() {
  const [items, setItems] = useState<DraftItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await salesFetch<DraftResponse>("/outreach/drafts");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drafts");
    }
  }

  async function setOutcome(id: number, outcome: string) {
    await salesFetch(`/outreach/drafts/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ outcome, owner: "Ane" }),
    });
    await load();
  }

  async function sendDraft(id: number) {
    await salesFetch(`/outreach/drafts/${id}/send`, { method: "POST" });
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <SalesShell title="Draft Review" subtitle="Review, approve, reject, or send outreach drafts.">
      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_10px_30px_rgba(0,0,0,.24)]">
        <div className="mb-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[#b7f7e6]">
          Approval workflow
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Review every draft before it goes out.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--muted)]">
          Use this as the human quality checkpoint. Approve strong drafts, push weak ones back, and only send what is actually ready.
        </p>
      </section>

      {error ? <div className="rounded-[var(--radius)] border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div> : null}

      <section className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="grid gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-2">
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass(item.outcome || "draft_only")}`}>
                    {titleize(item.outcome || "draft_only")}
                  </span>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-zinc-300">{titleize(item.channel || "email")}</span>
                </div>
                <div className="text-xl font-semibold">{item.company_name || "Untitled draft"}</div>
                <div className="text-sm text-[var(--muted)]">Contact: {item.contact_person || "Unknown"} {item.email ? `(${item.email})` : ""}</div>
                <div className="text-sm text-[var(--muted)]">Subject: {item.subject || "No subject"}</div>
                <div className="text-sm text-[var(--muted)]">Owner: {item.owner || "—"} • Created: {formatRelative(item.created_at)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 text-sm leading-7 whitespace-pre-wrap">
              {item.content || "No draft body."}
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => setOutcome(item.id, "approved_to_send")} className="rounded-xl border border-emerald-400/25 bg-emerald-900/40 px-4 py-2 text-sm font-bold text-emerald-100">Approve</button>
              <button onClick={() => setOutcome(item.id, "needs_edit")} className="rounded-xl border border-amber-400/25 bg-amber-900/40 px-4 py-2 text-sm font-bold text-amber-100">Needs edit</button>
              <button onClick={() => setOutcome(item.id, "rejected")} className="rounded-xl border border-red-400/25 bg-red-900/40 px-4 py-2 text-sm font-bold text-red-100">Reject</button>
              {item.outcome === "approved_to_send" ? (
                <button onClick={() => sendDraft(item.id)} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[#04130f]">Send now</button>
              ) : null}
            </div>
          </div>
        ))}
      </section>
    </SalesShell>
  );
}
