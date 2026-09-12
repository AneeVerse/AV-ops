"use client";

import { useEffect, useState } from "react";
import { SalesShell } from "@/components/sales-shell";
import { salesFetch, titleize } from "@/lib/api";

type ReportsOverview = {
  report?: {
    summary?: Record<string, number>;
    owner_counts?: Array<{ owner: string; count: number }>;
    lead_scores?: Array<{ id: number; company_name: string; owner?: string; source?: string; status?: string; score?: number; score_factors?: string }>;
    source_outcomes?: Array<{ source: string; total_leads: number; meetings: number; won: number; lost: number }>;
    template_type_counts?: Array<{ type: string; count: number }>;
  };
};

type TrendResponse = { items?: Array<{ day: string; sent_emails: number; replies: number; meetings: number; won: number; lost: number }> };
type QualityResponse = { report?: { summary?: Record<string, number> } };

function rateHint(value: number) {
  if (value >= 100) return "Check event volume / denominator";
  if (value >= 40) return "Strong";
  if (value >= 15) return "Developing";
  return "Weak";
}

export default function ReportsPage() {
  const [overview, setOverview] = useState<ReportsOverview>({});
  const [trend, setTrend] = useState<TrendResponse>({});
  const [quality, setQuality] = useState<QualityResponse>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      salesFetch<ReportsOverview>("/reports/overview"),
      salesFetch<TrendResponse>("/reports/trends?days=7"),
      salesFetch<QualityResponse>("/data-quality"),
    ])
      .then(([overviewData, trendData, qualityData]) => {
        setOverview(overviewData);
        setTrend(trendData);
        setQuality(qualityData);
      })
      .catch((err) => setError(err.message));
  }, []);

  const report = overview.report;
  const summary = report?.summary ?? {};
  const q = quality.report?.summary ?? {};

  return (
    <SalesShell title="Reports" subtitle="Operational, funnel, source, owner, and data-quality reporting.">
      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_10px_30px_rgba(0,0,0,.24)]">
        <div className="mb-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[#b7f7e6]">
          Reports
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">See what is actually happening in sales.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--muted)]">
          Weak sources, missing ownership, and poor follow-up hygiene should stand out immediately.
        </p>
      </section>

      {error ? <div className="rounded-[var(--radius)] border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[
          ["Total leads", summary.total_leads ?? 0, "Current tracked lead base"],
          ["Draft → sent", `${summary.draft_to_sent_rate ?? 0}%`, rateHint(Number(summary.draft_to_sent_rate ?? 0))],
          ["Reply → meeting", `${summary.reply_to_meeting_rate ?? 0}%`, rateHint(Number(summary.reply_to_meeting_rate ?? 0))],
          ["Won / lost", `${summary.closed_won ?? 0}/${summary.closed_lost ?? 0}`, "Closed outcomes"],
          ["Weak sources", q.weak_source_count ?? 0, "Needs normalization"],
          ["Unassigned owners", q.unassigned_owner_count ?? 0, "Should trend to zero"],
        ].map(([label, value, hint]) => (
          <div key={String(label)} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-4">
            <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">{label}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
            <div className="mt-2 text-xs text-[var(--muted)]">{hint}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="mb-4 text-lg font-semibold">Lead scores</div>
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="border-b border-[var(--border)] px-4 py-3">Lead</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Status</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Score</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Why</th>
                </tr>
              </thead>
              <tbody>
                {(report?.lead_scores ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="border-b border-[var(--border)] px-4 py-3">
                      <div className="font-medium">{item.company_name}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{titleize(item.source || "unknown source")} • {titleize(item.owner || "unassigned")}</div>
                    </td>
                    <td className="border-b border-[var(--border)] px-4 py-3">{titleize(item.status || "unknown")}</td>
                    <td className="border-b border-[var(--border)] px-4 py-3">{item.score ?? 0}</td>
                    <td className="border-b border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]">{item.score_factors || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="mb-4 text-lg font-semibold">Owner load</div>
            <div className="grid gap-3">
              {(report?.owner_counts ?? []).map((item) => {
                const max = Math.max(...(report?.owner_counts ?? []).map((x) => x.count || 0), 1);
                return (
                  <div key={item.owner}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{titleize(item.owner || "unassigned")}</span>
                      <span className="text-[var(--muted)]">{item.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-emerald-400" style={{ width: `${((item.count || 0) / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="mb-4 text-lg font-semibold">Template counts</div>
            <div className="grid gap-2 text-sm">
              {(report?.template_type_counts ?? []).map((item) => (
                <div key={item.type} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white/[0.02] px-3 py-2">
                  <span>{titleize(item.type || "unknown")}</span>
                  <span className="text-[var(--muted)]">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="mb-4 text-lg font-semibold">Source outcomes</div>
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="border-b border-[var(--border)] px-4 py-3">Source</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Total</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Meetings</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Won</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Lost</th>
                </tr>
              </thead>
              <tbody>
                {(report?.source_outcomes ?? []).map((item) => (
                  <tr key={item.source}>
                    <td className="border-b border-[var(--border)] px-4 py-3">{titleize(item.source || "unknown")}</td>
                    <td className="border-b border-[var(--border)] px-4 py-3">{item.total_leads}</td>
                    <td className="border-b border-[var(--border)] px-4 py-3">{item.meetings}</td>
                    <td className="border-b border-[var(--border)] px-4 py-3">{item.won}</td>
                    <td className="border-b border-[var(--border)] px-4 py-3">{item.lost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="mb-4 text-lg font-semibold">7 day trend</div>
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="border-b border-[var(--border)] px-4 py-3">Day</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Sent</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Replies</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Meetings</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Won</th>
                  <th className="border-b border-[var(--border)] px-4 py-3">Lost</th>
                </tr>
              </thead>
              <tbody>
                {(trend.items ?? []).map((item) => (
                  <tr key={item.day}>
                    <td className="border-b border-[var(--border)] px-4 py-3">{item.day}</td>
                    <td className="border-b border-[var(--border)] px-4 py-3">{item.sent_emails}</td>
                    <td className="border-b border-[var(--border)] px-4 py-3">{item.replies}</td>
                    <td className="border-b border-[var(--border)] px-4 py-3">{item.meetings}</td>
                    <td className="border-b border-[var(--border)] px-4 py-3">{item.won}</td>
                    <td className="border-b border-[var(--border)] px-4 py-3">{item.lost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </SalesShell>
  );
}
