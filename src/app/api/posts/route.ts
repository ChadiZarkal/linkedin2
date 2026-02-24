// src/app/api/posts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readCollection, updateInCollection, deleteFromCollection } from "@/lib/db";
import { seedDefaults } from "@/lib/seed";
import { publishPost, schedulePost } from "@/lib/workflow";
import type { Post } from "@/lib/types";

export async function GET() {
  seedDefaults();
  const posts = readCollection<Post>("posts").sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return NextResponse.json(posts);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Handle publish action
  if (body.action === "publish") {
    const result = await publishPost(body.id);
    if (result.success) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Handle schedule action
  if (body.action === "schedule") {
    if (!body.scheduledAt) return NextResponse.json({ error: "scheduledAt required" }, { status: 400 });
    try {
      const result = await schedulePost(body.id, body.scheduledAt);
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  // Handle approve/reject
  if (body.action === "approve") {
    body.status = "approved";
  } else if (body.action === "reject") {
    body.status = "rejected";
  }

  const updated = updateInCollection<Post>("posts", body.id, {
    ...body,
    updatedAt: new Date().toISOString(),
  });
  if (!updated) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const deleted = deleteFromCollection<Post>("posts", id);
  if (!deleted) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
