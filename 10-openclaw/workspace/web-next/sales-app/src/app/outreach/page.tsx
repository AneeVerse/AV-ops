"use client";

import { useState } from "react";
import { SalesShell } from "@/components/sales-shell";
import { salesFetch, titleize } from "@/lib/api";

type DraftResponse = {
  draft?: {
    company_name?: string;
    contact_person?: string;
    email?: string;
    channel?: string;
    subject?: string;
    activity_log_id?: number;
    body?: string;
  };
};

export default function OutreachPage() {
  const [leadId, setLeadId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [channel, setChannel] = useState("email");
  const [owner, setOwner] = useState("Ane");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState<DraftResponse["draft"]>();
  const [message, setMessage] = useState<string | null>(null);

  async function generateDraft() {
    try {
      setMessage("Generating draft...");
      const data = await salesFetch<DraftResponse>("/outreach/draft", {
        method: "POST",
        body: JSON.stringify({
          lead_id: Number(leadId),
          template_id: Number(templateId) || null,
          channel,
          owner,
          subject: subject || null,
          body: body || null,
        }),
      });
      setDraft(data.draft);
      setMessage("Draft created and logged.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Draft generation failed");
    }
  }

  return (
    <SalesShell title="Outreach" subtitle="Create a draft, review it cleanly, then move it to approval/send flow.">
      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[0_10px_30px_rgba(0,0,0,.24)]">
        <div className="mb-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[#b7f7e6]">
          Draft workspace
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Write outreach like a clean composer.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--muted)]">
          Generate a draft from a lead and optional template, inspect the message properly, then move it into review and send flow.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Compose draft</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">Still ID-based for now, but now on the new frontend.</p>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">Draft</span>
          </div>
          <div className="grid gap-3">
            <input value={leadId} onChange={(e) => setLeadId(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[#17191f] px-3 py-2.5 outline-none" placeholder="Lead ID" />
            <input value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[#17191f] px-3 py-2.5 outline-none" placeholder="Template ID (optional)" />
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[#17191f] px-3 py-2.5 outline-none">
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[#17191f] px-3 py-2.5 outline-none" placeholder="Owner" />
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[#17191f] px-3 py-2.5 outline-none" placeholder="Subject override (optional)" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-32 w-full rounded-xl border border-[var(--border)] bg-[#17191f] px-3 py-2.5 outline-none" placeholder="Body override (optional)" />
            <div className="flex flex-wrap gap-2">
              <button onClick={generateDraft} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[#04130f]">Generate draft</button>
              <a className="rounded-xl border border-[var(--border)] bg-[#2b2f39] px-4 py-2 text-sm" href="/outreach/review">Open review</a>
              <a className="rounded-xl border border-[var(--border)] bg-[#2b2f39] px-4 py-2 text-sm" href="/outreach/queue">Open send queue</a>
            </div>
            {message ? <div className="text-sm text-[var(--muted)]">{message}</div> : null}
          </div>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Draft preview</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">Review the actual message before sending it further.</p>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">{draft ? "Draft ready" : "No draft yet"}</span>
          </div>

          {draft ? (
            <div className="grid gap-3">
              <div className="grid gap-2 text-sm text-[var(--muted)]">
                <div><strong className="text-[var(--text)]">Company:</strong> {draft.company_name || "—"}</div>
                <div><strong className="text-[var(--text)]">Contact:</strong> {draft.contact_person || "—"}</div>
                <div><strong className="text-[var(--text)]">Email:</strong> {draft.email || "—"}</div>
                <div><strong className="text-[var(--text)]">Channel:</strong> {titleize(draft.channel || "—")}</div>
                <div><strong className="text-[var(--text)]">Subject:</strong> {draft.subject || "—"}</div>
                <div><strong className="text-[var(--text)]">Activity log:</strong> #{draft.activity_log_id || "—"}</div>
              </div>
              <div className="min-h-80 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 text-sm leading-7 whitespace-pre-wrap">
                {draft.body || "No body generated."}
              </div>
            </div>
          ) : (
            <div className="grid min-h-80 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 text-center text-sm text-[var(--muted)]">
              Generate a draft to preview the actual outreach message here.
            </div>
          )}
        </div>
      </section>
    </SalesShell>
  );
}
