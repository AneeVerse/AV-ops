"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SalesShell } from "@/components/sales-shell";
import { salesFetch, titleize } from "@/lib/api";

type LeadsSummary = { items?: Array<{ status: string; count: number }> };
type LeadsList = {
  items?: Array<{
    id: number;
    company_name?: string;
    niche?: string;
    contact_person?: string;
    status?: string;
    source?: string;
    owner?: string;
    next_action?: string;
  }>;
};

function statusClass(value = "") {
  const raw = value.toLowerCase();
  if (raw.includes("lost")) return "bg-red-400/15 text-red-200";
  if (raw.includes("follow") || raw.includes("new")) return "bg-amber-400/15 text-amber-200";
  if (raw.includes("interested") || raw.includes("meeting") || raw.includes("won") || raw.includes("qualified")) return "bg-emerald-400/15 text-emerald-200";
  return "bg-white/6 text-zinc-300";
}

function LeadsPageInner() {
  const params = useSearchParams();
  const [summary, setSummary] = useState<LeadsSummary>({});
  const [list, setList] = useState<LeadsList>({});
  const [filterOptions, setFilterOptions] = useState<LeadsList>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [owner, setOwner] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearch(params.get("q_text") || "");
    setStatus(params.get("status") || "");
    setSource(params.get("source") || "");
    setOwner(params.get("owner") || "");
  }, [params]);

  useEffect(() => {
    salesFetch<LeadsSummary>("/leads/summary")
      .then(setSummary)
      .catch((err) => setError(err.message));

    salesFetch<LeadsList>("/leads?limit=100")
      .then(setFilterOptions)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    salesFetch<LeadsList>(`/leads?limit=100&q_text=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`)
      .then((res) => {
        const items = (res.items ?? []).filter((item) => {
          const sourceOk = !source || (item.source || "").toLowerCase() === source.toLowerCase();
          const ownerOk = !owner || (item.owner || "").toLowerCase() === owner.toLowerCase();
          return sourceOk && ownerOk;
        });
        setList({ items });
      })
      .catch((err) => setError(err.message));
  }, [search, status, source, owner]);

  const items = list.items ?? [];
  const optionItems = filterOptions.items ?? [];
  const statusOptions = (summary.items ?? []).map((item) => item.status).filter(Boolean).sort((a, b) => titleize(a).localeCompare(titleize(b)));
  const sourceOptions = Array.from(new Set(optionItems.map((item) => item.source).filter(Boolean) as string[])).sort((a, b) => titleize(a).localeCompare(titleize(b)));
  const ownerOptions = Array.from(new Set(optionItems.map((item) => item.owner).filter((value): value is string => Boolean(value && value.toLowerCase() !== "unassigned")))).sort((a, b) => titleize(a).localeCompare(titleize(b)));
  const activeFilters = [
    search ? `Search: ${search}` : null,
    status ? `Status: ${titleize(status)}` : null,
    source ? `Source: ${titleize(source)}` : null,
    owner ? `Owner: ${titleize(owner)}` : null,
  ].filter(Boolean) as string[];

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setSource("");
    setOwner("");
  };

  return (
    <SalesShell title="Leads" subtitle="Filter fast, open the right record, and keep data sellable.">
      {error ? (
        <div className="rounded-[var(--radius)] border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(summary.items ?? []).map((item) => (
          <Link
            key={item.status}
            href={`/leads?status=${encodeURIComponent(item.status)}`}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-4 transition hover:border-white/20 hover:bg-white/[0.03]"
          >
            <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">{titleize(item.status)}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">{item.count}</div>
            <div className="mt-2 text-xs text-[var(--muted)]">lead records</div>
          </Link>
        ))}
      </section>

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Filter leads</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">Use real filters, then jump straight into the record that matters.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-[var(--border)] bg-[#17191f] px-3 py-2 text-xs text-zinc-300 transition hover:border-white/20 hover:text-white"
            >
              Clear filters
            </button>
            <Link href="/leads" className="rounded-lg border border-[var(--border)] bg-[#17191f] px-3 py-2 text-xs text-zinc-300 transition hover:border-white/20 hover:text-white">
              Reset view
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatus("")}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                !status
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[#b7f7e6]"
                  : "border-[var(--border)] bg-[#17191f] text-zinc-300 hover:border-white/20 hover:text-white"
              }`}
            >
              All statuses
            </button>
            {statusOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatus(option)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  status === option
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[#b7f7e6]"
                    : "border-[var(--border)] bg-[#17191f] text-zinc-300 hover:border-white/20 hover:text-white"
                }`}
              >
                {titleize(option)}
              </button>
            ))}
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,.7fr))]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[#17191f] px-3 py-2.5 outline-none"
              placeholder="Company, contact, email"
            />
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[#17191f] px-3 py-2.5 outline-none"
            >
              <option value="">All sources</option>
              {sourceOptions.map((option) => (
                <option key={option} value={option}>{titleize(option)}</option>
              ))}
            </select>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[#17191f] px-3 py-2.5 outline-none"
            >
              <option value="">All owners</option>
              <option value="unassigned">Unassigned</option>
              {ownerOptions.map((option) => (
                <option key={option} value={option}>{titleize(option)}</option>
              ))}
            </select>
          </div>
        </div>

        {activeFilters.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <span key={filter} className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-xs text-zinc-300">
                {filter}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Lead table</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{items.length} visible results. Open any lead to inspect full detail.</p>
          </div>
          <div className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">Live list</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="border-b border-[var(--border)] px-4 py-3">Lead</th>
                <th className="border-b border-[var(--border)] px-4 py-3">Niche</th>
                <th className="border-b border-[var(--border)] px-4 py-3">Contact</th>
                <th className="border-b border-[var(--border)] px-4 py-3">Status</th>
                <th className="border-b border-[var(--border)] px-4 py-3">Next action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02]">
                  <td className="border-b border-[var(--border)] px-4 py-3">
                    <Link href={`/leads/detail?id=${item.id}`} className="block hover:opacity-90">
                      <div className="font-medium">{item.company_name || "Untitled lead"}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">#{item.id} • {titleize(item.source || "unknown")}</div>
                    </Link>
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3">{item.niche || "—"}</td>
                  <td className="border-b border-[var(--border)] px-4 py-3">{item.contact_person || "—"}</td>
                  <td className="border-b border-[var(--border)] px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(item.status || "")}`}>
                      {titleize(item.status || "unassigned")}
                    </span>
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3">{item.next_action || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </SalesShell>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)] p-6 text-sm text-[var(--muted)]">Loading leads...</div>}>
      <LeadsPageInner />
    </Suspense>
  );
}
