import { NextRequest, NextResponse } from 'next/server';
import { resolveNextAuthToken } from '@/lib/nextauth-token';

function resolveCookieDomain(host: string | null): string | undefined {
  const hostname = String(host || '').split(':')[0].toLowerCase();
  if (!hostname || hostname === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return undefined;
  }
  if (hostname === 'maxed.life' || hostname.endsWith('.maxed.life')) {
    return '.maxed.life';
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const secureCookie = request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production';
  const token = await resolveNextAuthToken(request);
  const platformSessionToken = typeof token?.platformSessionToken === 'string'
    ? token.platformSessionToken
    : '';

  if (!platformSessionToken) {
    return NextResponse.json({ error: 'Platform session unavailable' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('maxed_session', platformSessionToken, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: secureCookie ? 'none' : 'lax',
    path: '/',
    domain: resolveCookieDomain(request.headers.get('host')),
    maxAge: 30 * 24 * 60 * 60,
  });
  return response;
}
