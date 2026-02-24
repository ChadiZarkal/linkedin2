// src/app/api/cron/route.ts
// Cron endpoint for Vercel CRON or external cron service
import { NextRequest, NextResponse } from "next/server";
import { runFullWorkflow, shouldPublishToday, publishScheduledPosts } from "@/lib/workflow";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // First: publish any scheduled posts whose time has come
  let scheduledResult = { published: 0, errors: [] as string[] };
  try {
    scheduledResult = await publishScheduledPosts();
  } catch (e) {
    console.error("Error publishing scheduled posts:", e);
  }

  // Then: run the auto workflow if needed
  if (!shouldPublishToday()) {
    return NextResponse.json({
      message: "No new publication needed today (quota reached or not a publish day)",
      published: false,
      scheduledPublished: scheduledResult.published,
      scheduledErrors: scheduledResult.errors,
    });
  }

  try {
    const run = await runFullWorkflow();
    return NextResponse.json({
      message: "Workflow completed",
      published: true,
      runId: run.id,
      status: run.status,
      scheduledPublished: scheduledResult.published,
      scheduledErrors: scheduledResult.errors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
