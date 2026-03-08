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

        // Dev fallback: accept hardcoded credentials (check first to avoid API timeout)
        if (
          (credentials.email === 'admin@maxed.dev' || credentials.email === 'admin@maxed.life') &&
          credentials.password === 'maxed2024'
        ) {
          return {
            id: '1',
            email: credentials.email,
            name: 'Admin User',
            firmId: '1',
          };
        }

        // TODO: Add /api/auth/login to platform API for real auth
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
