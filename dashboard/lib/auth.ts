import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100';
const NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  process.env.MAXED_API_KEY ||
  'maxed-dev-secret-change-me';

export const authOptions: NextAuthOptions = {
  secret: NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'Maxed Platform',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@yourfirm.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (res.ok) {
            const user = await res.json();
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              firmId: user.firmId,
              firmName: user.firmName,
              isPlatformAdmin: user.isPlatformAdmin ?? (user.email === 'admin@maxed.dev' || user.email === 'admin@maxed.life'),
              platformSessionToken: user.platformSessionToken,
              platformSessionExpiresAt: user.platformSessionExpiresAt,
            };
          }
        } catch {
          // API unavailable, fall through to dev credentials
        }

        // Dev fallback: accept hardcoded credentials when API is unreachable
        if (
          process.env.NODE_ENV !== 'production' &&
          (credentials.email === 'admin@maxed.dev' || credentials.email === 'admin@maxed.life') &&
          credentials.password === 'maxed2024'
        ) {
          return {
            id: '1',
            email: credentials.email,
            name: 'Admin User',
            role: 'admin',
            firmId: '1',
            firmName: 'Maxed',
            isPlatformAdmin: true,
          };
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.firmId = (user as any).firmId;
        token.role = (user as any).role;
        token.firmName = (user as any).firmName;
        token.isPlatformAdmin = (user as any).isPlatformAdmin;
        token.platformSessionToken = (user as any).platformSessionToken;
        token.platformSessionExpiresAt = (user as any).platformSessionExpiresAt;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).firmId = token.firmId;
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).firmName = token.firmName;
        (session.user as any).isPlatformAdmin = token.isPlatformAdmin;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
