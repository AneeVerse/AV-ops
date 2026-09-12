import { NextRequest, NextResponse } from "next/server";
import { createJob } from "@/lib/frameJobs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const job = await createJob(body);
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      name: job.name,
      message: "Job started",
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
