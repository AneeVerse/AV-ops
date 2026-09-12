"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SalesShell } from "@/components/sales-shell";
import { salesFetch, titleize } from "@/lib/api";

type LeadDetail = {
  id: number;
  company_name?: string;
  website?: string;
  niche?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  source?: string;
  owner?: string;
  status?: string;
  next_action?: string;
  notes?: string;
};

function LeadDetailInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    salesFetch<LeadDetail>(`/leads/${id}`)
      .then(setLead)
      .catch((err) => setError(err.message));
  }, [id]);

  return (
    <SalesShell title="Lead Detail" subtitle="Inspect one lead deeply before acting.">
      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_10px_30px_rgba(0,0,0,.24)]">
        <div className="mb-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[#b7f7e6]">
          Lead detail
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Single-record detail migration.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--muted)]">
          Detail parity is now wired to the live backend. Editable controls migrate next after the route switch is working.
        </p>
      </section>

      {error ? <div className="rounded-[var(--radius)] border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div> : null}

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
        {lead ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["Company", lead.company_name],
              ["Website", lead.website],
              ["Niche", lead.niche],
              ["Contact", lead.contact_person],
              ["Email", lead.email],
              ["Phone", lead.phone],
              ["Source", titleize(lead.source || "")],
              ["Owner", lead.owner],
              ["Status", titleize(lead.status || "")],
              ["Next action", lead.next_action],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
                <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">{label}</div>
                <div className="mt-2 text-sm leading-6">{value || "—"}</div>
              </div>
            ))}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 md:col-span-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">Notes</div>
              <div className="mt-2 text-sm leading-7 whitespace-pre-wrap">{lead.notes || "—"}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-[var(--muted)]">{id ? "Loading lead..." : "Missing lead id."}</div>
        )}
      </section>
    </SalesShell>
  );
}

export default function LeadDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)] p-6 text-sm text-[var(--muted)]">Loading lead detail...</div>}>
      <LeadDetailInner />
    </Suspense>
  );
}
