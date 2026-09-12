"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SalesShell } from "@/components/sales-shell";
import { salesFetch, titleize } from "@/lib/api";

type ReportsOverview = {
  report?: {
    summary?: Record<string, number>;
    lead_scores?: Array<{ id: number; company_name: string; owner?: string; source?: string; status?: string; score?: number }>;
    owner_counts?: Array<{ owner: string; count: number }>;
    source_outcomes?: Array<{ source: string; total_leads: number; won: number; lost: number }>;
    source_counts?: Array<{ source: string; count: number }>;
  };
};

type RemindersOverview = {
  reminders?: {
    summary?: {
      overdue_count?: number;
      due_today_count?: number;
      unscheduled_pending_count?: number;
    };
  };
};

function priorityClass(score: number) {
  if (score >= 80) return "bg-red-400/15 text-red-200";
  if (score >= 50) return "bg-amber-400/15 text-amber-200";
  return "bg-emerald-400/15 text-emerald-200";
}

export default function DashboardPage() {
  const [data, setData] = useState<{ reports?: ReportsOverview; reminders?: RemindersOverview; error?: string }>({});

  useEffect(() => {
    Promise.all([
      salesFetch<ReportsOverview>("/reports/overview"),
      salesFetch<RemindersOverview>("/reminders/overview"),
    ])
      .then(([reports, reminders]) => setData({ reports, reminders }))
      .catch((error) => setData({ error: error.message }));
  }, []);

  const report = data.reports?.report;
  const summary = report?.summary ?? {};
  const reminders = data.reminders?.reminders?.summary ?? {};
  const scores = report?.lead_scores ?? [];
  const owners = report?.owner_counts ?? [];
  const sources = report?.source_outcomes ?? [];
  const unknown = report?.source_counts?.find((x) => x.source === "unknown")?.count ?? 0;
  const unassigned = owners.find((x) => x.owner === "unassigned")?.count ?? 0;
  const maxOwner = Math.max(...owners.map((x) => x.count || 0), 1);
  const hygieneItems = [
    ["Overdue", reminders.overdue_count ?? 0],
    ["Due today", reminders.due_today_count ?? 0],
    ["Unknown source", unknown],
    ["No owner", unassigned],
  ];

  return (
    <SalesShell
      title="Dashboard"
      subtitle="Everything important in one screen."
      headerActions={
        <>
          <a className="rounded-lg border border-[var(--border)] bg-[#2b2f39] px-2.5 py-1.5 text-[11px]" href="/reminders">Reminders</a>
          <a className="rounded-lg border border-[var(--border)] bg-[#2b2f39] px-2.5 py-1.5 text-[11px]" href="/reports">Reports</a>
          <a className="rounded-lg border border-[var(--border)] bg-[#2b2f39] px-2.5 py-1.5 text-[11px]" href="/leads">Leads</a>
        </>
      }
    >
      {data.error ? (
        <div className="rounded-[var(--radius)] border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
          {data.error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:min-h-[calc(100vh-92px)] xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total leads", summary.total_leads ?? 0, "Current lead base", "/leads"],
            ["Meetings booked", summary.booked_meetings ?? 0, "Leads in booked stage", "/pipeline?status=meeting%20booked"],
            ["Won deals", summary.closed_won ?? 0, "Closed won count", "/pipeline?status=closed%20won"],
            ["Pending follow-ups", summary.pending_followups ?? 0, "Still waiting on action", "/followups"],
          ].map(([label, value, hint, href]) => (
            <Link
              key={String(label)}
              href={String(href)}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-4 transition hover:border-white/20 hover:bg-white/[0.03]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-xl font-semibold uppercase tracking-tight text-white">{label}</div>
                <div className="text-xl font-semibold tracking-tight text-white">{value}</div>
              </div>
              <div className="mt-2 text-xs text-[var(--muted)]">{hint}</div>
            </Link>
          ))}
        </section>

        <section className="grid min-h-0 gap-4 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1.18fr)_minmax(300px,.82fr)_minmax(320px,.9fr)] xl:items-stretch">
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 min-h-0 xl:flex xl:h-full xl:min-h-0 xl:flex-col">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Priority leads</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">Top scored leads that deserve immediate attention.</p>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">{scores.length}</span>
            </div>
            <div className="min-h-0 overflow-auto xl:flex-1 pr-1">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    <th className="border-b border-[var(--border)] px-4 py-3">Lead</th>
                    <th className="border-b border-[var(--border)] px-4 py-3">Status</th>
                    <th className="border-b border-[var(--border)] px-4 py-3">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.02]">
                      <td className="border-b border-[var(--border)] px-4 py-3 align-top">
                        <Link href={`/leads/detail?id=${item.id}`} className="block">
                          <div className="font-medium">{item.company_name}</div>
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            {titleize(item.owner || "unassigned")} • {titleize(item.source || "unknown")}
                          </div>
                        </Link>
                      </td>
                      <td className="border-b border-[var(--border)] px-4 py-3 whitespace-nowrap">{titleize(item.status || "unknown")}</td>
                      <td className="border-b border-[var(--border)] px-4 py-3">
                        <Link href={`/leads/detail?id=${item.id}`} className="inline-block">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${priorityClass(Number(item.score || 0))}`}>
                            {item.score ?? 0}
                          </span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid min-h-0 gap-4 xl:h-full xl:grid-rows-[minmax(0,1fr)_minmax(0,.9fr)]">
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 xl:flex xl:flex-col">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Owner load</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">Who currently owns the work?</p>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">Current</span>
              </div>
              <div className="grid gap-3 xl:flex-1 xl:content-start">
                {owners.map((item) => (
                  <div key={item.owner} className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span>{titleize(item.owner || "unassigned")}</span>
                      <span className="text-[var(--muted)]">{item.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-emerald-400" style={{ width: `${((item.count || 0) / maxOwner) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 xl:flex xl:flex-col">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Hygiene</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">Where the system is getting sloppy.</p>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">Signals</span>
              </div>
              <div className="grid gap-3 xl:flex-1 xl:content-start">
                {hygieneItems.map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-sm">
                    <span className="text-[var(--muted)]">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 min-h-0 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Source quality</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">Which sources are generating outcomes?</p>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">{sources.length}</span>
            </div>
            <div className="grid gap-3 xl:flex-1 xl:content-start xl:overflow-auto pr-1">
              {sources.map((item) => (
                <Link href={`/leads?source=${encodeURIComponent(item.source || "")}`} key={item.source} className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 transition hover:border-white/20 hover:bg-white/[0.03]">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{titleize(item.source || "unknown")}</span>
                    <span className="text-[var(--muted)]">{item.total_leads} leads</span>
                  </div>
                  <div className="mt-1.5 text-xs text-[var(--muted)]">Won {item.won} • Lost {item.lost}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </SalesShell>
  );
}
