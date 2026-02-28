// src/app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readCollectionAsync, writeCollectionAsync } from "@/lib/db";
import { seedDefaultsAsync } from "@/lib/seed";
import type { Settings } from "@/lib/types";

export async function GET() {
  await seedDefaultsAsync();
  const settings = await readCollectionAsync<Settings>("settings");
  return NextResponse.json(settings[0] || {});
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  await seedDefaultsAsync();
  const settings = await readCollectionAsync<Settings>("settings");
  const current = settings[0] || { id: "settings" };
  const updated = { ...current, ...body, id: "settings" };
  await writeCollectionAsync("settings", [updated]);
  return NextResponse.json(updated);
}
