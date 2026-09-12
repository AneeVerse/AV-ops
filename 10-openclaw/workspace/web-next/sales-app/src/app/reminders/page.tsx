"use client";

import { useEffect, useState } from "react";
import { SalesShell } from "@/components/sales-shell";
import { salesFetch, titleize } from "@/lib/api";

type ReminderOverview = {
  reminders?: {
    summary?: {
      due_today_count?: number;
      overdue_count?: number;
      due_soon_count?: number;
      unscheduled_pending_count?: number;
    };
    action_queue?: Array<{
      company_name?: string;
      title?: string;
      detail?: string;
      urgency?: string;
      status?: string;
      due_at?: string;
      owner?: string;
    }>;
  };
};

function urgencyClass(value = "") {
  const raw = value.toLowerCase();
  if (raw.includes("overdue")) return "bg-red-400/15 text-red-200";
  if (raw.includes("today")) return "bg-amber-400/15 text-amber-200";
  if (raw.includes("soon")) return "bg-emerald-400/15 text-emerald-200";
  return "bg-white/6 text-zinc-300";
}

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
  return `in ${Math.round(h / 24)}d`;
}

export default function RemindersPage() {
  const [data, setData] = useState<ReminderOverview>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    salesFetch<ReminderOverview>("/reminders/overview")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const summary = data.reminders?.summary ?? {};
  const queue = data.reminders?.action_queue ?? [];

  return (
    <SalesShell title="Reminders" subtitle="Queue, hygiene, and automation cleanup.">
      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_10px_30px_rgba(0,0,0,.24)]">
        <div className="mb-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[#b7f7e6]">
          Automation hygiene
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Keep the follow-up queue clean and actionable.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--muted)]">
          This should behave like an inbox: what is overdue, what needs action today, and what still lacks a real due date.
        </p>
      </section>

      {error ? <div className="rounded-[var(--radius)] border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Due today", summary.due_today_count ?? 0, "Needs action before day end"],
          ["Overdue", summary.overdue_count ?? 0, "Late and blocking cleanliness"],
          ["Due soon", summary.due_soon_count ?? 0, "Upcoming queue pressure"],
          ["No due date", summary.unscheduled_pending_count ?? 0, "Should trend to zero"],
        ].map(([label, value, hint]) => (
          <div key={String(label)} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-4">
            <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">{label}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
            <div className="mt-2 text-xs text-[var(--muted)]">{hint}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Action queue</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">Ordered by urgency so the late work stands out first.</p>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">Queue</span>
          </div>
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="border-b border-[var(--border)] px-4 py-3">Lead</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Task</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Urgency</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Due</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Owner</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item, index) => (
                  <tr key={`${item.company_name}-${index}`}>
                    <td className="border-b border-[var(--border)] px-4 py-3 font-medium">{item.company_name || "—"}</td>
                    <td className="border-b border-[var(--border)] px-4 py-3">
                      <div>{item.title || "Untitled reminder"}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{item.detail || ""}</div>
                    </td>
                    <td className="border-b border-[var(--border)] px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${urgencyClass(item.urgency || "")}`}>
                        {titleize(item.urgency || "scheduled")}
                      </span>
                    </td>
                    <td className="border-b border-[var(--border)] px-4 py-3">
                      <div className="font-medium">{formatRelative(item.due_at)}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{item.due_at || "No due date set"}</div>
                    </td>
                    <td className="border-b border-[var(--border)] px-4 py-3">{item.owner || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Operator notes</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">Quick interpretation, not just counts.</p>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">Guidance</span>
          </div>
          <div className="grid gap-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 text-sm leading-6 text-[var(--muted)]">
              {summary.overdue_count ?? 0} overdue and {summary.due_today_count ?? 0} due today. This is the first place to attack if execution feels sloppy.
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 text-sm leading-6 text-[var(--muted)]">
              {summary.unscheduled_pending_count ?? 0} pending reminders still have no due date. Those should be pushed toward zero.
            </div>
          </div>
        </div>
      </section>
    </SalesShell>
  );
}
