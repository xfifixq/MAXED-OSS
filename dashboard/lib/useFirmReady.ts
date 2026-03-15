'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { setFirmId } from './api';

/**
 * Hook that returns the authenticated firm's ID and a ready flag.
 * Service pages should wait for isReady before making API calls
 * to avoid the race condition where _firmId is still the default '1'.
 */
export function useFirmReady() {
  const { data: session, status } = useSession();
  const [firmId, setFirmIdState] = useState<string | null>(null);

  useEffect(() => {
    const id = (session?.user as any)?.firmId;
    if (id) {
      setFirmId(id);
      setFirmIdState(id);
    }
  }, [session]);

  return {
    firmId,
    isReady: status === 'authenticated' && !!firmId,
    isLoading: status === 'loading',
  };
}
