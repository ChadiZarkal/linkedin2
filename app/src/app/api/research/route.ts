// ============================================================
// POST /api/research - Research a topic via web search
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateWithSearch } from '@/lib/gemini';
import { getPrompts } from '@/lib/github';
import { requireAuth, sanitizeError } from '@/lib/auth';
import type { ResearchResult, ApiResponse } from '@/lib/types';

export const maxDuration = 120;

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<ResearchResult>>> {
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const { topic } = await req.json();
    
    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing topic' }, { status: 400 });
    }
    if (topic.length > 500) {
      return NextResponse.json({ success: false, error: 'Topic trop long (max 500 caractères)' }, { status: 400 });
    }

    const prompts = await getPrompts();

    // Build system prompt: global + research agent
    const systemParts: string[] = [];
    if (prompts.globalPrompt?.trim()) {
      systemParts.push(prompts.globalPrompt.trim());
    }
    systemParts.push(prompts.research);
    const systemPrompt = systemParts.join('\n\n---\n\n');

    // Call Gemini with Google Search grounding
    const userPrompt = `Recherche les dernières actualités et informations sur : "${topic}"

Donne-moi un résumé structuré avec les points clés, les tendances récentes et les informations les plus pertinentes.`;

    const { text, sources } = await generateWithSearch(userPrompt, systemPrompt);

    const result: ResearchResult = {
      topic,
      content: text,
      sources,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('Research error:', err);
    return NextResponse.json(
      { success: false, error: sanitizeError(err) },
      { status: 500 }
    );
  }
}
