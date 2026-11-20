import { NextRequest, NextResponse } from 'next/server';
import { maintenanceHtml, loginHtml, pageHeaders } from './maintenance/admin-page';

// This build is intentionally admin-only. Reopening requires a source change.
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === '/health') return NextResponse.json({ ok: true, maintenance: true }, { headers: { 'Cache-Control': 'no-store' } });
  if (path === '/admin-access' && ['GET','HEAD'].includes(request.method)) {
    const nonce = crypto.randomUUID().replaceAll('-', '');
    return new NextResponse(request.method === 'HEAD' ? null : loginHtml(nonce), {
      headers: { ...pageHeaders, 'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'` },
    });
  }
  if (path === '/api/maintenance/login' && request.method === 'POST') return NextResponse.next();
  if (path.startsWith('/_next/static/')) return NextResponse.next();
  const token = request.cookies.get('gb_admin_session')?.value;
  if (token) {
    try {
      const base = process.env.API_INTERNAL_BASE_URL?.replace(/\/+$/, '');
      if (!base) throw new Error('Backend is not configured');
      const result = await fetch(base + '/maintenance/access', {
        headers: { Authorization: token }, cache: 'no-store', signal: AbortSignal.timeout(12000),
      });
      if (result.ok && (await result.json()).admin === true) {
        const forwarded = new Headers(request.headers);
        forwarded.set('authorization', token);
        const response = NextResponse.next({ request: { headers: forwarded } });
        response.headers.set('Cache-Control', 'private, no-store');
        return response;
      }
    } catch { /* A database or backend failure never opens public access. */ }
  }
  const json = path.startsWith('/api/') || path.startsWith('/socket.io/') || !['GET','HEAD'].includes(request.method);
  return new NextResponse(request.method === 'HEAD' ? null : json
    ? JSON.stringify({ error:'SITE_MAINTENANCE',message:'GalaxyBets is under maintenance.' }) : maintenanceHtml, {
    status:503,headers:{...pageHeaders,'Retry-After':'300','Content-Type':json?'application/json; charset=utf-8':'text/html; charset=utf-8',
      'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"},
  });
}
export const config = { matcher: '/:path*' };
