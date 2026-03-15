'use client';

import { useEffect } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { NotificationProvider } from '@/lib/notifications';
import { setFirmId } from '@/lib/api';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const WORKSPACE_ROUTES = new Set([
  '/dashboard/bookkeeping',
  '/dashboard/documents',
  '/dashboard/invoicing',
  '/dashboard/proposals',
  '/dashboard/reporting',
  '/dashboard/workflows',
  '/dashboard/chat',
  '/dashboard/time-tracking',
  '/dashboard/crm',
]);

function FirmIdSync({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  useEffect(() => {
    const firmId = (session?.user as any)?.firmId;
    if (firmId) setFirmId(firmId);
  }, [session]);
  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isWorkspaceRoute = WORKSPACE_ROUTES.has(pathname);

  return (
    <SessionProvider>
      <NotificationProvider>
        <FirmIdSync>
          <div className={`flex min-h-screen ${isWorkspaceRoute ? 'bg-white' : 'bg-gray-50'}`}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <TopBar />
              <main className={isWorkspaceRoute ? 'flex-1 overflow-hidden' : 'flex-1 p-6'}>
                {children}
              </main>
            </div>
          </div>
        </FirmIdSync>
      </NotificationProvider>
    </SessionProvider>
  );
}
