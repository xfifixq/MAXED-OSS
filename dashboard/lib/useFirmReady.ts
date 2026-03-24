'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { getPlatformSessionToken, setFirmId, setPlatformSessionToken } from './api';

/**
 * Hook that returns the authenticated firm's ID and a ready flag.
 * Service pages should wait for isReady before making API calls
 * to avoid the race condition where _firmId is still the default '1'.
 */
export function useFirmReady() {
  const { data: session, status } = useSession();
  const [firmId, setFirmIdState] = useState<string | null>(null);
  const [platformSessionReady, setPlatformSessionReady] = useState(false);

  useEffect(() => {
    const id = (session?.user as any)?.firmId;
    const platformSessionToken = (session?.user as any)?.platformSessionToken;
    if (id) {
      setFirmId(id);
      setFirmIdState(id);
    }

    if (platformSessionToken) {
      setPlatformSessionToken(platformSessionToken);
      setPlatformSessionReady(true);
      return;
    }

    setPlatformSessionReady(Boolean(getPlatformSessionToken()));
  }, [session]);

  return {
    firmId,
    isReady: status === 'authenticated' && !!firmId && platformSessionReady,
    isLoading: status === 'loading',
  };
}
