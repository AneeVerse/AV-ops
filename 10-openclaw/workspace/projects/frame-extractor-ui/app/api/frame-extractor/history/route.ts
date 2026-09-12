import { NextResponse } from "next/server";
import { listJobs } from "@/lib/frameJobs";

export const dynamic = "force-dynamic";

export async function GET() {
  const jobs = await listJobs();
  return NextResponse.json({ jobs }, { headers: { "Cache-Control": "no-store" } });
}
