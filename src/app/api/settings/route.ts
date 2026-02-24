// src/app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readCollection, writeCollection } from "@/lib/db";
import { seedDefaults } from "@/lib/seed";
import type { Settings } from "@/lib/types";

export async function GET() {
  seedDefaults();
  const settings = readCollection<Settings>("settings");
  return NextResponse.json(settings[0] || {});
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const settings = readCollection<Settings>("settings");
  const current = settings[0] || { id: "settings" };
  const updated = { ...current, ...body, id: "settings" };
  writeCollection("settings", [updated]);
  return NextResponse.json(updated);
}
