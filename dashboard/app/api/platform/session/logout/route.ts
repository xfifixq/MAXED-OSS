import { NextRequest, NextResponse } from 'next/server';
import { resolveNextAuthToken } from '@/lib/nextauth-token';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100';

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
  const token = await resolveNextAuthToken(request);
  const platformSessionToken = typeof token?.platformSessionToken === 'string'
    ? token.platformSessionToken
    : '';

  if (platformSessionToken) {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${platformSessionToken}`,
        },
      });
    } catch {
      // Best-effort revocation; clear browser cookie either way.
    }
  }

  const response = NextResponse.json({ ok: true });
  const secure = request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production';
  response.cookies.set('maxed_session', '', {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    domain: resolveCookieDomain(request.headers.get('host')),
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}
