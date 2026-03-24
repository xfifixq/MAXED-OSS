import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const platformSessionToken = typeof (session?.user as any)?.platformSessionToken === 'string'
    ? (session?.user as any).platformSessionToken
    : '';

  if (session && platformSessionToken) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
