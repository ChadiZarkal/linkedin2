// ============================================================
// GET/PUT /api/schedule - Manage scheduling configuration
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSchedule, saveSchedule } from '@/lib/github';
import { requireAuth, sanitizeError } from '@/lib/auth';
import type { Schedule, ApiResponse } from '@/lib/types';

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<Schedule>>> {
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const schedule = await getSchedule();
    return NextResponse.json({ success: true, data: schedule });
  } catch (err) {
    console.error('Get schedule error:', err);
    return NextResponse.json(
      { success: false, error: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse<ApiResponse<Schedule>>> {
  const authError2 = requireAuth(req);
  if (authError2) return authError2;

  try {
    const body = await req.json();
    const current = await getSchedule();
    
    // Validate fields
    const days = Array.isArray(body.days) 
      ? body.days.filter((d: unknown) => typeof d === 'number' && d >= 0 && d <= 6)
      : current.days;
    const time = typeof body.time === 'string' && /^\d{2}:\d{2}$/.test(body.time)
      ? body.time : current.time;
    const minBuffer = typeof body.minBuffer === 'number' && body.minBuffer >= 1 && body.minBuffer <= 20
      ? body.minBuffer : current.minBuffer;
    
    const updated: Schedule = {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
      days,
      time,
      autoGenerate: typeof body.autoGenerate === 'boolean' ? body.autoGenerate : current.autoGenerate,
      minBuffer,
      defaultTopic: typeof body.defaultTopic === 'string' ? body.defaultTopic : current.defaultTopic,
    };

    await saveSchedule(updated);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update schedule error:', err);
    return NextResponse.json(
      { success: false, error: sanitizeError(err) },
      { status: 500 }
    );
  }
}
