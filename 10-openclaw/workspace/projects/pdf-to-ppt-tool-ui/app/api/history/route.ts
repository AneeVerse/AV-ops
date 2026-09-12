import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const raw = await readFile(join(process.cwd(), "data", "history.json"), "utf8");
    const history = JSON.parse(raw);
    return NextResponse.json({ ok: true, history: Array.isArray(history) ? history : [] });
  } catch {
    return NextResponse.json({ ok: true, history: [] });
  }
}
