import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

function parseDriveId(urlOrId: string) {
  const trimmed = urlOrId.trim();
  const fileMatch = trimmed.match(/\/file\/d\/([^/]+)/);
  if (fileMatch) return fileMatch[1];
  const idMatch = trimmed.match(/[?&]id=([^&]+)/);
  if (idMatch) return idMatch[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  throw new Error("Only Google Drive file links are supported in this version.");
}

function cleanName(name: string) {
  return name.replace(/\.[a-z0-9]{2,5}$/i, "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.videoUrl) return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    const fileId = parseDriveId(body.videoUrl);
    const { stdout } = await execFileAsync("gog", ["drive", "get", fileId, "--json"], {
      timeout: 1000 * 60,
      maxBuffer: 1024 * 1024 * 5,
    });
    const meta = JSON.parse(stdout.trim() || "{}");
    const file = meta.file || {};
    return NextResponse.json({
      fileId,
      name: file.name || "Video frames",
      extractName: cleanName(file.name || "Video frames"),
      mimeType: file.mimeType,
      size: file.size,
      webViewLink: file.webViewLink,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
