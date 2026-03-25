import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveNextAuthToken } from '@/lib/nextauth-token';
import { getPlatformAuthUrls } from '@/lib/server-platform';

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
  const session = await getServerSession(authOptions);
  const sessionPlatformToken = typeof (session?.user as any)?.platformSessionToken === 'string'
    ? (session?.user as any).platformSessionToken
    : '';
  const token = sessionPlatformToken ? null : await resolveNextAuthToken(request);
  const platformSessionToken =
    sessionPlatformToken ||
    (typeof token?.platformSessionToken === 'string'
      ? token.platformSessionToken
      : '');

  if (platformSessionToken) {
    for (const baseUrl of getPlatformAuthUrls()) {
      try {
        await fetch(`${baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${platformSessionToken}`,
          },
        });
        break;
      } catch {
        // Try the next internal/public auth endpoint.
      }
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
