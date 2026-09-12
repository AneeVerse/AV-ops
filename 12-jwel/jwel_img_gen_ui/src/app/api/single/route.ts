import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const N8N_SINGLE_URL =
  process.env.N8N_SINGLE_URL || "http://127.0.0.1:5678/webhook/jwel-img-gen-single";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Upload field 'image' is required." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const imageDataUrl = `data:${file.type || "image/jpeg"};base64,${base64}`;

    const payload = {
      filename: file.name || "input.jpg",
      image_data_url: imageDataUrl,
      prompt: String(form.get("prompt") || ""),
      output_folder_id: String(form.get("output_folder_id") || ""),
    };

    const upstream = await fetch(N8N_SINGLE_URL, {
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
