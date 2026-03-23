'use client';

import { useEffect } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { NotificationProvider } from '@/lib/notifications';
import { setFirmId, setPlatformSessionToken } from '@/lib/api';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

function FirmIdSync({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  useEffect(() => {
    const firmId = (session?.user as any)?.firmId;
    const platformSessionToken = (session?.user as any)?.platformSessionToken;
    if (firmId) setFirmId(firmId);
    if (platformSessionToken) setPlatformSessionToken(platformSessionToken);
  }, [session]);
  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <NotificationProvider>
        <FirmIdSync>
          <div className="flex min-h-screen bg-gray-50">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <TopBar />
              <main className="flex-1 p-6">
                {children}
              </main>
            </div>
          </div>
        </FirmIdSync>
      </NotificationProvider>
    </SessionProvider>
  );
}
