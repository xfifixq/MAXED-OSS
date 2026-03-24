'use client';

import { useEffect, useState } from 'react';
import { SessionProvider, signOut, useSession } from 'next-auth/react';
import { NotificationProvider } from '@/lib/notifications';
import {
  apiUrl,
  clearFirmId,
  clearPlatformSessionToken,
  installApiFetchCredentials,
  setFirmId,
  setPlatformSessionToken,
} from '@/lib/api';
import {
  clearBrowserPlatformSessionCookie,
  setBrowserPlatformSessionCookie,
} from '@/lib/platform-session-client';
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

    async function syncPlatformSession() {
      if (status === 'loading') {
        if (active) setReady(false);
        return;
      }

      if (status !== 'authenticated') {
        clearFirmId();
        clearPlatformSessionToken();
        clearBrowserPlatformSessionCookie();
        if (active) {
          setError('');
          setReady(true);
        }
        return;
      }

      const firmId = (session?.user as any)?.firmId;
      const platformSessionToken = (session?.user as any)?.platformSessionToken;

      if (!firmId || !platformSessionToken) {
        clearFirmId();
        clearPlatformSessionToken();
        clearBrowserPlatformSessionCookie();
        if (active) {
          setError('Platform session unavailable. Sign in again to continue.');
          setReady(false);
        }
        await signOut({ redirect: true, callbackUrl: '/login' });
        return;
      }

      setFirmId(firmId);
      setPlatformSessionToken(platformSessionToken);
      setBrowserPlatformSessionCookie(platformSessionToken);

      try {
        const res = await fetch(apiUrl('/api/auth/session'), {
          credentials: 'include',
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error || 'Unable to establish Maxed session.');
        }

        if (active) {
          setError('');
          setReady(true);
        }
      } catch (err) {
        clearFirmId();
        clearPlatformSessionToken();
        clearBrowserPlatformSessionCookie();

        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to establish Maxed session.');
          setReady(false);
        }

        await signOut({ redirect: true, callbackUrl: '/login' });
      }
    }

    syncPlatformSession();
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
        Establishing Maxed session...
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
