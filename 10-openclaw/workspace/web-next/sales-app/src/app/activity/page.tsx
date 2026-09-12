"use client";

import { useEffect, useState } from "react";
import { SalesShell } from "@/components/sales-shell";
import { salesFetch, titleize } from "@/lib/api";

type ActivityItem = {
  id: number;
  company_name?: string;
  activity_type?: string;
  channel?: string;
  subject?: string;
  outcome?: string;
  owner?: string;
  created_at?: string;
  contact_person?: string;
};

type ActivityResponse = { items?: ActivityItem[] };

function formatRelative(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(Math.abs(diffMs) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}M ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}H ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}D ago`;
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
}

function formatAbsolute(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function activityIcon(item: ActivityItem) {
  const raw = `${item.activity_type || ""} ${item.channel || ""} ${item.subject || ""}`.toLowerCase();
  if (raw.includes("whatsapp")) return "💬";
  if (raw.includes("call")) return "📞";
  if (raw.includes("mail") || raw.includes("email")) return "✉️";
  if (raw.includes("meeting") || raw.includes("booked")) return "📅";
  if (raw.includes("note")) return "📝";
  if (raw.includes("task")) return "✅";
  return "📝";
}

function badgeClass(value = "") {
  const raw = value.toLowerCase();
  if (raw.includes("lost") || raw.includes("rejected")) return "bg-red-400/15 text-red-200";
  if (raw.includes("pending") || raw.includes("follow")) return "bg-amber-400/15 text-amber-200";
  if (raw.includes("won") || raw.includes("booked") || raw.includes("interested") || raw.includes("sent") || raw.includes("connected")) return "bg-emerald-400/15 text-emerald-200";
  return "bg-white/6 text-zinc-300";
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    salesFetch<ActivityResponse>("/activity")
      .then((res) => setItems(res.items ?? []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <SalesShell title="Activity" subtitle="Calls, WhatsApp logs, and lead history.">
      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_10px_30px_rgba(0,0,0,.24)]">
        <div className="mb-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[#b7f7e6]">
          Activity log
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Keep a clean trail of lead interactions.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--muted)]">
          Log form migration comes next. This page already brings the timeline into the new frontend with readable timestamps and cleaner outcomes.
        </p>
      </section>

      {error ? <div className="rounded-[var(--radius)] border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div> : null}

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Recent timeline</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">Readable event history with humanized timestamps and clearer outcomes.</p>
          </div>
        </div>
        <div className="grid gap-3">
          {items.length ? items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-4 shadow-[0_8px_24px_rgba(0,0,0,.18)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--muted)]">
                    <span className="text-base leading-none" aria-hidden="true">{activityIcon(item)}</span>
                    <span>{titleize(item.channel || item.activity_type || "Activity")}</span>
                    <span className={`rounded-full px-2.5 py-1 ${badgeClass(item.outcome || item.activity_type || "")}`}>
                      {titleize(item.outcome || item.activity_type || "Logged")}
                    </span>
                  </div>
                  <h4 className="mt-2 line-clamp-2 text-base font-semibold leading-6">
                    {titleize(item.subject || item.activity_type || "Activity")}
                  </h4>
                </div>
                <div className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-zinc-300">
                  {formatRelative(item.created_at)}
                </div>
              </div>

              <div className="mt-3 min-w-0">
                <div className="line-clamp-1 font-medium">{item.company_name || "Unknown lead"}</div>
                <div className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">{item.contact_person || "No contact name"}</div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-zinc-300">
                <span className="rounded-full bg-white/5 px-2.5 py-1">Assigned {item.owner || "—"}</span>
              </div>

              <div className="mt-3 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                {formatAbsolute(item.created_at)} · {formatRelative(item.created_at)}
              </div>
            </article>
          )) : (
            <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-4 text-sm text-[var(--muted)]">
              No activity logged yet.
            </div>
          )}
        </div>
      </section>
    </SalesShell>
  );
}
