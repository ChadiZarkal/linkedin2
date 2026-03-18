// ============================================================
// POST /api/generate - Generate a LinkedIn post from research
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateContent } from '@/lib/gemini';
import { getPrompts, savePost, generateId } from '@/lib/github';
import { requireAuth, sanitizeError } from '@/lib/auth';
import type { Post, ApiResponse } from '@/lib/types';

export const maxDuration = 120;

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<Post>>> {
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const { topic, research, sources } = await req.json();

    if (!topic || !research) {
      return NextResponse.json(
        { success: false, error: 'Missing topic or research' },
        { status: 400 }
      );
    }

    const prompts = await getPrompts();

    // Build system prompt: global + writer agent
    const systemParts: string[] = [];
    if (prompts.globalPrompt?.trim()) {
      systemParts.push(prompts.globalPrompt.trim());
    }
    systemParts.push(prompts.writer);
    const systemPrompt = systemParts.join('\n\n---\n\n');

    const userPrompt = `Voici le sujet : "${topic}"

Voici les informations de recherche :
${research}

Rédige un post LinkedIn basé sur ces informations. Le post doit être engageant, informatif et professionnel.`;

    const content = await generateContent(userPrompt, systemPrompt);

    // Create post object
    const post: Post = {
      id: generateId(),
      topic,
      research,
      content,
      sources: Array.isArray(sources) ? sources.filter((s: unknown) => typeof s === 'string') : [],
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    // Save to GitHub
    await savePost(post);

    return NextResponse.json({ success: true, data: post });
  } catch (err) {
    console.error('Generate error:', err);
    return NextResponse.json(
      { success: false, error: sanitizeError(err) },
      { status: 500 }
    );
  }
}
