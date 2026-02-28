// src/app/api/workflow/route.ts
import { NextResponse } from "next/server";
import { dailyCron } from "@/lib/workflow";

export const maxDuration = 300;

export async function POST() {
  try {
    const result = await dailyCron();
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
