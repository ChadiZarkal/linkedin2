// ============================================================
// Next.js Proxy — Protects pages + API routes
// Reads api_key cookie for browser, Authorization/x-api-key for API clients
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest) {
  const apiSecret = process.env.API_SECRET;

  // No protection if no secret set (dev convenience)
  if (!apiSecret) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Cron has its own auth (CRON_SECRET)
  if (pathname === '/api/cron') return NextResponse.next();

  // API routes: check multiple auth methods
  if (pathname.startsWith('/api/')) {
    const authHeader = req.headers.get('authorization');
    const apiKeyHeader = req.headers.get('x-api-key');
    const cookieKey = req.cookies.get('api_key')?.value;

    const provided =
      (authHeader ? authHeader.replace('Bearer ', '') : null) ||
      apiKeyHeader ||
      cookieKey;

    if (provided === apiSecret) {
      return NextResponse.next();
    }

    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  // Login page is always accessible
  if (pathname === '/login') return NextResponse.next();

  // All other pages: require valid cookie
  const cookieKey = req.cookies.get('api_key')?.value;
  if (cookieKey === apiSecret) return NextResponse.next();

  // Redirect to login
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/', '/posts', '/prompts', '/schedule', '/agents', '/topics', '/workflow', '/api/:path*'],
};
