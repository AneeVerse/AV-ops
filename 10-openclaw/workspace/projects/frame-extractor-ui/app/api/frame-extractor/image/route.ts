import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

async function downloadDriveFile(fileId: string, outPath: string) {
  await execFileAsync("gog", ["drive", "download", fileId, "--out", outPath], {
    timeout: 1000 * 60 * 5,
    maxBuffer: 1024 * 1024 * 10,
  });
}

export async function GET(req: NextRequest) {
  const fileId = req.nextUrl.searchParams.get("id");
  const download = req.nextUrl.searchParams.get("download") === "1";
  const name = req.nextUrl.searchParams.get("name") || "frame.jpg";

  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return NextResponse.json({ error: "Valid Drive file id is required" }, { status: 400 });
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "frame-image-"));
  const outPath = path.join(dir, name.endsWith(".jpg") ? name : `${name}.jpg`);

  try {
    await downloadDriveFile(fileId, outPath);
    const data = await readFile(outPath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": download ? `attachment; filename="${path.basename(outPath)}"` : "inline",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
