import { NextRequest, NextResponse } from "next/server";
import { deleteJob } from "@/lib/frameJobs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    const job = await deleteJob(body.jobId);
    if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
    return NextResponse.json({ ok: true, deletedJobId: job.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
