import { NextRequest, NextResponse } from "next/server";
import { renameJob } from "@/lib/frameJobs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.jobId || !body.name) return NextResponse.json({ error: "jobId and name are required" }, { status: 400 });
    const job = await renameJob(body.jobId, body.name);
    if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
    return NextResponse.json({ ok: true, job });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
