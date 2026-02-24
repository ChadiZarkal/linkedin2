// src/app/api/test-gemini/route.ts
import { NextResponse } from "next/server";
import { generateContent, generateWithSearch } from "@/lib/gemini";

export async function GET() {
  try {
    const result = await generateContent(
      "Dis 'Bonjour! Le LLM fonctionne parfaitement.' en une phrase.",
      undefined,
      "Tu es un assistant amical qui répond en français."
    );
    return NextResponse.json({ success: true, response: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await generateWithSearch(
      "Quelles sont les dernières tendances en IA en 2026 ? Donne un résumé court.",
      undefined,
      "Tu es un expert en veille technologique."
    );
    return NextResponse.json({ success: true, response: result.text, sources: result.sources });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
