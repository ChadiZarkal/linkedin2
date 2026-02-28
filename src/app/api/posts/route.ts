// src/app/api/posts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readCollectionAsync, updateInCollectionAsync, deleteFromCollectionAsync } from "@/lib/db";
import { seedDefaultsAsync } from "@/lib/seed";
import { publishPost, generateTechWowPost } from "@/lib/workflow";
import type { Post } from "@/lib/types";

export const maxDuration = 120;

export async function GET() {
  await seedDefaultsAsync();
  const posts = (await readCollectionAsync<Post>("posts")).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return NextResponse.json(posts);
}

export async function POST() {
  // Generate a new post on demand
  try {
    const post = await generateTechWowPost();
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Publish
  if (body.action === "publish") {
    const result = await publishPost(body.id);
    if (result.success) return NextResponse.json({ success: true });
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Approve
  if (body.action === "approve") {
    const updated = await updateInCollectionAsync<Post>("posts", body.id, {
      status: "approved",
    } as Partial<Post>);
    if (!updated) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json(updated);
  }

  // Reject
  if (body.action === "reject") {
    const updated = await updateInCollectionAsync<Post>("posts", body.id, {
      status: "rejected",
    } as Partial<Post>);
    if (!updated) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json(updated);
  }

  // Edit content
  if (body.content !== undefined) {
    const updated = await updateInCollectionAsync<Post>("posts", body.id, {
      content: body.content,
    } as Partial<Post>);
    if (!updated) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "No valid action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const deleted = await deleteFromCollectionAsync<Post>("posts", id);
  if (!deleted) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
