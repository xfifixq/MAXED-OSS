import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  process.env.MAXED_API_KEY ||
  'maxed-dev-secret-change-me';

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
  const token = await getToken({ req: request, secret: NEXTAUTH_SECRET });
  const platformSessionToken = typeof token?.platformSessionToken === 'string'
    ? token.platformSessionToken
    : '';

  if (!platformSessionToken) {
    return NextResponse.json({ error: 'Platform session unavailable' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  const secure = request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production';
  response.cookies.set('maxed_session', platformSessionToken, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    domain: resolveCookieDomain(request.headers.get('host')),
    maxAge: 30 * 24 * 60 * 60,
  });
  return response;
}
