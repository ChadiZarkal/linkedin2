// src/app/api/agents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readCollectionAsync, writeCollectionAsync, addToCollectionAsync, updateInCollectionAsync, deleteFromCollectionAsync } from "@/lib/db";
import { seedDefaultsAsync } from "@/lib/seed";
import type { Agent } from "@/lib/types";

export async function GET() {
  await seedDefaultsAsync();
  const agents = (await readCollectionAsync<Agent>("agents")).sort((a, b) => a.order - b.order);
  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const defaultModeId = `mode-${Date.now().toString(36)}`;
  const agent: Agent = {
    id: `agent-${Date.now().toString(36)}`,
    name: body.name,
    role: body.role,
    description: body.description || "",
    prompt: body.prompt,
    promptModes: body.promptModes || [{ id: defaultModeId, name: "Standard", prompt: body.prompt }],
    activePromptModeId: body.activePromptModeId || defaultModeId,
    model: body.model || "gemini-2.5-pro",
    enabled: body.enabled ?? true,
    order: body.order || 99,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await addToCollectionAsync("agents", agent);
  return NextResponse.json(agent, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updated = await updateInCollectionAsync<Agent>("agents", body.id, {
    ...body,
    updatedAt: new Date().toISOString(),
  });
  if (!updated) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const deleted = await deleteFromCollectionAsync<Agent>("agents", id);
  if (!deleted) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
