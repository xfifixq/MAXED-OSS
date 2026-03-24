'use client';

import { useEffect, useState } from 'react';
import { SessionProvider, signOut, useSession } from 'next-auth/react';
import { NotificationProvider } from '@/lib/notifications';
import { apiUrl, clearFirmId, installApiFetchCredentials, setFirmId } from '@/lib/api';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

function FirmIdSync({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    installApiFetchCredentials();
  }, []);

  useEffect(() => {
    let active = true;

    async function sync() {
      if (status === 'loading') return;
      if (status !== 'authenticated') {
        clearFirmId();
        if (active) setReady(true);
        return;
      }

      const firmId = (session?.user as any)?.firmId;
      const platformSessionToken = (session?.user as any)?.platformSessionToken;
      if (firmId) setFirmId(firmId);

      try {
        const res = await fetch('/api/platform/session/bootstrap', {
          method: 'POST',
          credentials: 'include',
          headers: platformSessionToken
            ? { Authorization: `Bearer ${platformSessionToken}` }
            : undefined,
        });

        if (!res.ok) {
          const fallback = await fetch(apiUrl('/api/auth/session'), {
            credentials: 'include',
          }).catch(() => null);

          if (fallback?.ok) {
            if (active) {
              setError('');
              setReady(true);
            }
            return;
          }

          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error || 'Unable to establish a secure Maxed session.');
        }

        if (active) {
          setError('');
          setReady(true);
        }
      } catch (err) {
        if (active) {
          clearFirmId();
          setError(err instanceof Error ? err.message : 'Unable to establish a secure Maxed session.');
        }
        await signOut({ redirect: true, callbackUrl: '/login' });
      }
    }

    sync();
    return () => {
      active = false;
    };
  }, [session, status]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      </div>
    );
  }

  if (status === 'loading' || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        Establishing secure session...
      </div>
    );
  }

  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <FirmIdSync>
        <NotificationProvider>
          <div className="flex min-h-screen bg-gray-50">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <TopBar />
              <main className="flex-1 p-6">
                {children}
              </main>
            </div>
          </div>
        </NotificationProvider>
      </FirmIdSync>
    </SessionProvider>
  );
}
