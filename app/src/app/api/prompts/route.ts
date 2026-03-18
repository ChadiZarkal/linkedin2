// ============================================================
// GET/PUT /api/prompts - Manage agent prompts
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getPrompts, savePrompts } from '@/lib/github';
import { requireAuth, sanitizeError } from '@/lib/auth';
import type { Prompts, ApiResponse } from '@/lib/types';

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<Prompts>>> {
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const prompts = await getPrompts();
    return NextResponse.json({ success: true, data: prompts });
  } catch (err) {
    console.error('Get prompts error:', err);
    return NextResponse.json(
      { success: false, error: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse<ApiResponse<Prompts>>> {
  const authError2 = requireAuth(req);
  if (authError2) return authError2;

  try {
    const body = await req.json();
    const current = await getPrompts();
    
    // Validate: all fields must be strings
    const research = typeof body.research === 'string' ? body.research : current.research;
    const writer = typeof body.writer === 'string' ? body.writer : current.writer;
    const globalPrompt = typeof body.globalPrompt === 'string' ? body.globalPrompt : current.globalPrompt;
    
    const updated: Prompts = { research, writer, globalPrompt };

    await savePrompts(updated);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update prompts error:', err);
    return NextResponse.json(
      { success: false, error: sanitizeError(err) },
      { status: 500 }
    );
  }
}
