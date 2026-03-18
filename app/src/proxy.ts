// ============================================================
// Next.js Proxy - Protects the entire app with API_SECRET
// For API routes: checks Authorization header, x-api-key, or ?key=
// For pages: checks cookie or redirects to login
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest) {
  const apiSecret = process.env.API_SECRET;

  // No protection in dev or if no secret set
  if (!apiSecret) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // API routes: check header/key
  if (pathname.startsWith('/api/')) {
    // Allow cron with its own auth
    if (pathname === '/api/cron') return NextResponse.next();

    const authHeader = req.headers.get('authorization');
    const apiKeyHeader = req.headers.get('x-api-key');
    const urlKey = req.nextUrl.searchParams.get('key');
    const cookieKey = req.cookies.get('api_key')?.value;

    const provided = authHeader?.replace('Bearer ', '') || apiKeyHeader || urlKey || cookieKey;

    if (provided === apiSecret) {
      return NextResponse.next();
    }

    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Pages: check cookie
  if (pathname === '/login') return NextResponse.next();
  
  const cookieKey = req.cookies.get('api_key')?.value;
  if (cookieKey === apiSecret) return NextResponse.next();

  // Redirect to login
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/', '/posts', '/prompts', '/schedule', '/api/:path*'],
};
