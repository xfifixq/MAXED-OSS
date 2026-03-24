import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveNextAuthToken } from '@/lib/nextauth-token';

export async function middleware(request: NextRequest) {
  const token = await resolveNextAuthToken(request);
  const hasPlatformSessionToken = typeof token?.platformSessionToken === 'string' && token.platformSessionToken.length > 0;

  const { pathname } = request.nextUrl;

  // Allow auth-related routes
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login
  if ((!token || !hasPlatformSessionToken) && pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
