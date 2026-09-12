import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 900;

const N8N_BATCH_URL =
  process.env.N8N_BATCH_URL || "http://127.0.0.1:5678/webhook/jwel-img-gen-batch";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    if (!payload?.input_folder_url && !payload?.input_folder_id && !payload?.folder_url) {
      return NextResponse.json(
        { success: false, error: "Google Drive input folder link is required." },
        { status: 400 },
      );
    }

    const upstream = await fetch(N8N_BATCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { success: false, error: text || upstream.statusText };
    }

    return NextResponse.json(body, { status: upstream.ok ? 200 : upstream.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
