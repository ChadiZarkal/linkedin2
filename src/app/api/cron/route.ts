// src/app/api/cron/route.ts
// Daily cron: publish scheduled posts, auto-publish if enabled, maintain post buffer
import { NextRequest, NextResponse } from "next/server";
import {
  shouldPublishToday,
  publishScheduledPosts,
  publishNextPending,
  ensurePostBuffer,
  runTechWowWorkflow,
  runFullWorkflow,
} from "@/lib/workflow";
import { readCollectionAsync } from "@/lib/db";
import { seedDefaultsAsync } from "@/lib/seed";
import type { Settings } from "@/lib/types";

export const maxDuration = 300; // 5 min max for buffer generation

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await seedDefaultsAsync();
  const settings = (await readCollectionAsync<Settings>("settings"))[0];
  const log: Record<string, unknown> = { timestamp: new Date().toISOString() };

  // 1. Publish any scheduled posts whose time has come
  try {
    const scheduledResult = await publishScheduledPosts();
    log.scheduledPublished = scheduledResult.published;
    log.scheduledErrors = scheduledResult.errors;
  } catch (e) {
    log.scheduledError = e instanceof Error ? e.message : String(e);
  }

  // 2. If autoPublish is ON and it's a publish day → publish the oldest pending post
  if (settings?.autoPublish && shouldPublishToday()) {
    try {
      const pubResult = await publishNextPending();
      log.autoPublished = pubResult.success;
      log.autoPublishedPostId = pubResult.postId;
      if (!pubResult.success) log.autoPublishError = pubResult.error;
    } catch (e) {
      log.autoPublishError = e instanceof Error ? e.message : String(e);
    }
  } else if (!shouldPublishToday()) {
    log.autoPublished = false;
    log.reason = "Already published today or not a publish day";
  }

  // 3. Generate new posts to maintain the buffer (default 5 pending)
  try {
    const bufferResult = await ensurePostBuffer();
    log.bufferGenerated = bufferResult.generated;
    log.bufferTotal = bufferResult.total;
  } catch (e) {
    log.bufferError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    message: "Cron completed",
    ...log,
  });
}
