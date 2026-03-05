'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalLayout from '@/components/PortalLayout';

export default function PortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const clientId = localStorage.getItem('clientId');
    if (!clientId) {
      router.push('/login');
    } else {
      setAuthorized(true);
    }
  }, [router]);

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    );
  }

  return <PortalLayout>{children}</PortalLayout>;
}
