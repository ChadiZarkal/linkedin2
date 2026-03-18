// ============================================================
// Authentication helper for API routes (defense-in-depth)
// Middleware handles primary auth; this is a safety net
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export function requireAuth(req: NextRequest): NextResponse<{success: false; error: string}> | null {
  const apiSecret = process.env.API_SECRET;
  
  // In development, skip auth if no secret is set
  if (!apiSecret && process.env.NODE_ENV === 'development') {
    return null;
  }

  // Require API_SECRET in production
  if (!apiSecret) {
    return NextResponse.json(
      { success: false, error: 'Server misconfigured: API_SECRET not set' },
      { status: 500 }
    );
  }

  // Check Authorization header, x-api-key header, or api_key cookie
  const authHeader = req.headers.get('authorization');
  const apiKeyHeader = req.headers.get('x-api-key');
  const cookieKey = req.cookies.get('api_key')?.value;

  const providedKey =
    (authHeader ? authHeader.replace('Bearer ', '') : null) ||
    apiKeyHeader ||
    cookieKey;

  if (providedKey !== apiSecret) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return null; // Auth OK
}

// Sanitize error messages to prevent leaking internals
export function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    // Remove sensitive patterns
    const msg = err.message
      .replace(/Bearer [^\s"]+/gi, 'Bearer [REDACTED]')
      .replace(/ghp_[a-zA-Z0-9]+/g, '[REDACTED_TOKEN]')
      .replace(/token=[^\s&"]+/gi, 'token=[REDACTED]');
    return msg;
  }
  return 'An internal error occurred';
}

// Validate and sanitize a post ID (prevent path traversal)
export function sanitizeId(id: string): string | null {
  if (!id || typeof id !== 'string') return null;
  // Only allow alphanumeric, hyphens, underscores
  const clean = id.replace(/[^a-zA-Z0-9\-_]/g, '');
  if (clean !== id || clean.length === 0 || clean.length > 100) return null;
  return clean;
}
