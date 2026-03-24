import { getToken } from 'next-auth/jwt';

const NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  process.env.MAXED_API_KEY ||
  'maxed-dev-secret-change-me';

export async function resolveNextAuthToken(request: Request) {
  const url = new URL(request.url);
  const secureCookie = url.protocol === 'https:' || process.env.NODE_ENV === 'production';

  return (
    await getToken({
      req: request as any,
      secret: NEXTAUTH_SECRET,
      secureCookie,
      cookieName: secureCookie ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
    }) ||
    await getToken({
      req: request as any,
      secret: NEXTAUTH_SECRET,
      secureCookie,
    }) ||
    await getToken({
      req: request as any,
      secret: NEXTAUTH_SECRET,
      cookieName: 'next-auth.session-token',
    })
  );
}

