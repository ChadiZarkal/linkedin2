// src/app/api/cron/route.ts
// Daily cron - generates posts buffer + auto-publishes if enabled
import { NextRequest, NextResponse } from "next/server";
import { dailyCron } from "@/lib/workflow";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await dailyCron();
    return NextResponse.json({
      message: "Daily cron completed",
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
