// src/app/api/topics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readCollection, updateInCollection, deleteFromCollection } from "@/lib/db";
import { seedDefaults } from "@/lib/seed";
import type { Topic } from "@/lib/types";

export async function GET() {
  seedDefaults();
  const topics = readCollection<Topic>("topics").sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return NextResponse.json(topics);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updated = updateInCollection<Topic>("topics", body.id, {
    ...body,
    updatedAt: new Date().toISOString(),
  });
  if (!updated) return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const deleted = deleteFromCollection<Topic>("topics", id);
  if (!deleted) return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
