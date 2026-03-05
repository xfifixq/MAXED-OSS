import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
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

        // Try to authenticate against the Maxed API
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            return {
              id: data.user?.id || '1',
              email: data.user?.email || credentials.email,
              name: data.user?.name || 'Admin User',
              firmId: data.user?.firmId || '1',
            };
          }
        } catch {
          // API not available, fall through to dev credentials
        }

        // Dev fallback: accept hardcoded credentials
        if (
          credentials.email === 'admin@maxed.dev' &&
          credentials.password === 'maxed2024'
        ) {
          return {
            id: '1',
            email: 'admin@maxed.dev',
            name: 'Admin User',
            firmId: '1',
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).firmId = token.firmId;
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
