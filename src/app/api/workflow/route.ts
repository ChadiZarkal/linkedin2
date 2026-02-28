// src/app/api/workflow/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readCollection } from "@/lib/db";
import { stepResearch, stepGenerate, stepOrchestrate, runFullWorkflow, revisePost, runTechWowWorkflow, ensurePostBuffer } from "@/lib/workflow";
import type { WorkflowRun } from "@/lib/types";

export const maxDuration = 300;

export async function GET() {
  const runs = readCollection<WorkflowRun>("workflow_runs").sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
  return NextResponse.json(runs);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  try {
    switch (body.action) {
      // ─── Interactive Step 1: Research topics ───
      case "research": {
        const result = await stepResearch({
          recency: body.recency || "week",
          categories: body.categories || [],
          customTopic: body.customTopic || "",
          maxSuggestions: body.maxSuggestions || 4,
          model: body.model,
        });
        return NextResponse.json(result, { status: 201 });
      }

      // ─── Interactive Step 2: Generate post from selected topic ───
      case "generate": {
        const result = await stepGenerate({
          workflowId: body.workflowId,
          selectedTopic: body.selectedTopic,
          model: body.model,
          promptModeId: body.promptModeId,
          includeImages: body.includeImages ?? false,
        });
        return NextResponse.json(result, { status: 201 });
      }

      // ─── Orchestrator: AI decides the pipeline ───
      case "orchestrate": {
        const result = await stepOrchestrate({
          instruction: body.instruction,
          model: body.model,
          promptModeId: body.promptModeId,
          includeImages: body.includeImages ?? false,
        });
        return NextResponse.json(result, { status: 201 });
      }

      // ─── Tech Wow: Advanced AI vulgarization workflow ───
      case "tech_wow": {
        const result = await runTechWowWorkflow({ model: body.model });
        return NextResponse.json(result, { status: 201 });
      }

      // ─── Ensure post buffer ───
      case "ensure_buffer": {
        const result = await ensurePostBuffer(body.minBuffer);
        return NextResponse.json(result, { status: 200 });
      }

      // ─── Revise: Re-generate with user feedback ───
      case "revise": {
        const result = await revisePost({
          postId: body.postId,
          feedback: body.feedback,
          model: body.model,
          promptModeId: body.promptModeId,
        });
        return NextResponse.json(result, { status: 200 });
      }

      // ─── Full auto workflow ───
      case "auto":
      default: {
        const run = await runFullWorkflow({
          topicId: body.topicId,
          customTopic: body.customTopic,
          model: body.model,
        });
        return NextResponse.json(run, { status: 201 });
      }
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
