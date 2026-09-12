"use client";

import { useEffect, useMemo, useState } from "react";
import { SalesShell } from "@/components/sales-shell";
import { salesFetch, titleize } from "@/lib/api";

type Followup = {
  id: number;
  company_name?: string;
  title?: string;
  detail?: string;
  due_at?: string;
  status?: string;
  owner?: string;
};

type FollowupList = { items?: Followup[] };
type FollowupSummary = { items?: Array<{ status: string; count: number }> };

function formatRelative(iso?: string) {
  if (!iso) return "No due date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = date.getTime() - Date.now();
  const mins = Math.round(diffMs / 60000);
  if (Math.abs(mins) < 1) return "now";
  if (mins < 0) {
    const ago = Math.abs(mins);
    if (ago < 60) return `${ago}m overdue`;
    const h = Math.round(ago / 60);
    if (h < 24) return `${h}h overdue`;
    return `${Math.round(h / 24)}d overdue`;
  }
  if (mins < 60) return `in ${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `in ${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `in ${d}d`;
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
}

function badgeClass(status = "") {
  const raw = status.toLowerCase();
  if (raw.includes("cancel") || raw.includes("overdue")) return "bg-red-400/15 text-red-200";
  if (raw.includes("pending")) return "bg-amber-400/15 text-amber-200";
  if (raw.includes("done")) return "bg-emerald-400/15 text-emerald-200";
  return "bg-white/6 text-zinc-300";
}

export default function FollowupsPage() {
  const [summary, setSummary] = useState<FollowupSummary>({});
  const [items, setItems] = useState<Followup[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    salesFetch<FollowupSummary>("/followups/summary")
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    salesFetch<FollowupList>(`/followups?q_text=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`)
      .then((res) => setItems(res.items ?? []))
      .catch((err) => setError(err.message));
  }, [search, status]);

  const filtered = useMemo(() => items, [items]);

  return (
    <SalesShell title="Follow-ups" subtitle="Create, filter, edit, and track active follow-up work.">
      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_10px_30px_rgba(0,0,0,.24)]">
        <div className="mb-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[#b7f7e6]">
          Follow-up control
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Keep the task queue tight and actionable.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--muted)]">
          Live queue parity first. Full create/edit workflow migration follows once the main route set is standing.
        </p>
      </section>

      {error ? <div className="rounded-[var(--radius)] border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(summary.items ?? []).map((item) => (
          <div key={item.status} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-4">
            <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">{titleize(item.status)}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">{item.count}</div>
            <div className="mt-2 text-xs text-[var(--muted)]">follow-ups</div>
          </div>
        ))}
      </section>

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[#17191f] px-3 py-2.5 outline-none"
            placeholder="Search title or company"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[#17191f] px-3 py-2.5 outline-none"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="in_progress">In progress</option>
          </select>
        </div>
      </section>

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Task list</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">Readable queue with clearer urgency.</p>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="border-b border-[var(--border)] px-4 py-3">Lead</th>
                <th className="border-b border-[var(--border)] px-4 py-3">Task</th>
                <th className="border-b border-[var(--border)] px-4 py-3">Due</th>
                <th className="border-b border-[var(--border)] px-4 py-3">Status</th>
                <th className="border-b border-[var(--border)] px-4 py-3">Owner</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td className="border-b border-[var(--border)] px-4 py-3 font-medium">{item.company_name || "Unknown lead"}</td>
                  <td className="border-b border-[var(--border)] px-4 py-3">
                    <div>{item.title || "Untitled follow-up"}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">{item.detail || ""}</div>
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3">
                    <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass(item.due_at && new Date(item.due_at).getTime() < Date.now() ? "overdue" : "scheduled")}`}>
                      {formatRelative(item.due_at)}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">{item.due_at || "No due date set"}</div>
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass(item.status || "")}`}>
                      {titleize(item.status || "pending")}
                    </span>
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3">{item.owner || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </SalesShell>
  );
}
