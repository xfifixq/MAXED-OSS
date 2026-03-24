'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { setFirmId, setPlatformSessionToken } from './api';

/**
 * Hook that returns the authenticated firm's ID and a ready flag.
 * The dashboard layout primes the platform session before any workspace renders.
 */
export function useFirmReady() {
  const { data: session, status } = useSession();
  const [firmId, setFirmIdState] = useState<string | null>(null);

  useEffect(() => {
    const id = (session?.user as any)?.firmId;
    const platformSessionToken = (session?.user as any)?.platformSessionToken;

    if (id) {
      setFirmId(id);
      setFirmIdState(id);
    } else {
      setFirmIdState(null);
    }

    if (platformSessionToken) {
      setPlatformSessionToken(platformSessionToken);
    }
  }, [session]);

  return {
    firmId,
    isReady: status === 'authenticated' && !!firmId,
    isLoading: status === 'loading',
  };
}
