import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

export const runtime = "nodejs";
export const maxDuration = 1500;

const execFileAsync = promisify(execFile);

type N8nPayload = Record<string, unknown> & {
  success?: boolean;
  error?: string;
  message?: string;
};

const historyFile = join(process.cwd(), "data", "history.json");

async function appendHistory(entry: N8nPayload) {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  let existing: N8nPayload[] = [];
  try {
    existing = JSON.parse(await readFile(historyFile, "utf8")) as N8nPayload[];
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }
  const next = [{ ...entry, created_at: new Date().toISOString() }, ...existing].slice(0, 100);
  await writeFile(historyFile, JSON.stringify(next, null, 2));
}

export async function POST(request: Request) {
  const webhookUrl = process.env.N8N_PDF_TO_PPT_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, error: "N8N_PDF_TO_PPT_WEBHOOK_URL is not configured" },
      { status: 500 }
    );
  }

  const incoming = await request.formData();
  const file = incoming.get("pdf_file") ?? incoming.get("file");
  const projectName = String(incoming.get("project_name") ?? "").trim();
  const targetSlideCount = String(incoming.get("target_slide_count") ?? "10").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "PDF file is required" }, { status: 400 });
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ success: false, error: "Only PDF files are supported" }, { status: 400 });
  }

  if (!projectName) {
    return NextResponse.json({ success: false, error: "Project name is required" }, { status: 400 });
  }

  const tempDir = await mkdtemp(join(tmpdir(), "pdf-to-ppt-ui-"));
  const safeName = file.name.replace(/[^a-z0-9_.-]+/gi, "_").slice(0, 120) || `${randomUUID()}.pdf`;
  const tempPdf = join(tempDir, safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`);

  try {
    await writeFile(tempPdf, Buffer.from(await file.arrayBuffer()));

    const { stdout } = await execFileAsync(
      "curl",
      [
        "-sS",
        "-X",
        "POST",
        webhookUrl,
        "-F",
        `pdf_file=@${tempPdf};type=application/pdf`,
        "-F",
        `project_name=${projectName}`,
        "-F",
        `target_slide_count=${targetSlideCount || "10"}`,
        "--max-time",
        "1500",
      ],
      {
        maxBuffer: 1024 * 1024 * 20,
        timeout: 25 * 60 * 1000,
      }
    );

    let payload: N8nPayload;
    try {
      payload = JSON.parse(stdout) as N8nPayload;
    } catch {
      payload = { success: false, error: stdout || "n8n returned an empty response" };
    }

    if (payload.success === false) {
      return NextResponse.json(
        {
          success: false,
          error: payload.error || payload.message || "n8n workflow returned success=false",
          details: payload,
        },
        { status: 502 }
      );
    }

    await appendHistory(payload);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Could not complete the PDF-to-PPT generation request.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
