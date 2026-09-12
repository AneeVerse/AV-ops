import { NextResponse } from "next/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export const runtime = "nodejs";

function createJobId() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `pdf-ppt-${timestamp}-${random}`;
}

export async function POST(request: Request) {
  const webhookUrl = process.env.N8N_UPLOAD_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, error: "N8N_UPLOAD_WEBHOOK_URL is not configured" },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "PDF file is required" }, { status: 400 });
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ ok: false, error: "Only PDF files are supported" }, { status: 400 });
  }

  const uploadedAt = new Date().toISOString();
  const jobId = createJobId();
  const buffer = Buffer.from(await file.arrayBuffer());

  let extractedText = "";
  let pageCount: number | null = null;

  try {
    const result = await pdfParse(buffer);
    extractedText = (result.text || "").trim();
    pageCount = result.numpages || null;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Could not extract text from this PDF. It may be encrypted, damaged, scanned, or unsupported.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 422 }
    );
  }

  const status = extractedText.length > 0 ? "extracted" : "needs_ocr";

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: jobId,
      file_name: file.name,
      uploaded_at: uploadedAt,
      extracted_at: new Date().toISOString(),
      status,
      page_count: pageCount,
      text_length: extractedText.length,
    }),
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  return NextResponse.json(payload, { status: response.status });
}
