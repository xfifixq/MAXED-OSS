'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from './api';
import { useFirmReady } from './useFirmReady';

export type ServiceHealth = 'connected' | 'degraded' | 'disconnected' | 'unknown';

export interface ServiceStatusEntry {
  key: string;
  configured: boolean;
  source: 'firm' | 'env' | 'none';
  health: ServiceHealth;
  code?: number;
}

const SERVICE_KEYS = [
  'paperless',
  'docuseal',
  'invoiceninja',
  'n8n',
  'kimai',
  'bigcapital',
  'twenty',
  'metabase',
  'mattermost',
] as const;

export function useServiceStatus() {
  const { isReady, firmId } = useFirmReady();
  const [statuses, setStatuses] = useState<Record<string, ServiceStatusEntry>>({});
  const [serviceUrls, setServiceUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function fetchStatuses() {
      try {
        const [statusRes, urlsRes] = await Promise.all([
          fetch(apiUrl('/api/services/status')),
          fetch(apiUrl('/api/services/urls')),
        ]);

        const statusJson = statusRes.ok ? await statusRes.json() : {};
        const urlsJson = urlsRes.ok ? await urlsRes.json() : {};

        let diagnoseJson: Record<string, any> = {};
        if (firmId) {
          const diagnoseRes = await fetch(apiUrl('/api/services/diagnose'), {
            headers: { 'X-Firm-Id': firmId },
          });
          diagnoseJson = diagnoseRes.ok ? await diagnoseRes.json() : {};
        }

        if (!active) return;

        const nextStatuses = SERVICE_KEYS.reduce<Record<string, ServiceStatusEntry>>((acc, key) => {
          const healthData = statusJson?.[key];
          const hasFirmScope = Boolean(firmId);
          const configured = hasFirmScope ? Boolean(diagnoseJson?.[key]?.configured) : false;
          const source = (hasFirmScope ? diagnoseJson?.[key]?.source : 'none') as ServiceStatusEntry['source'];
          let health: ServiceHealth = 'unknown';

          if (!hasFirmScope) {
            health = 'unknown';
          } else if (!configured) {
            health = 'disconnected';
          } else if (healthData?.status === 'connected') {
            health = 'connected';
          } else if (healthData?.status === 'unavailable') {
            health = 'degraded';
          }

          acc[key] = {
            key,
            configured,
            source,
            health,
            code: healthData?.code,
          };
          return acc;
        }, {});

        setStatuses(nextStatuses);
        setServiceUrls(urlsJson);
      } catch {
        if (!active) return;
        setStatuses((current) => current);
      }
    }

    if (isReady && firmId) {
      fetchStatuses();
      const interval = window.setInterval(fetchStatuses, 60000);
      return () => {
        active = false;
        window.clearInterval(interval);
      };
    }

    fetchStatuses();
    return () => {
      active = false;
    };
  }, [firmId, isReady]);

  const summary = useMemo(() => {
    const entries = Object.values(statuses);
    return {
      connected: entries.filter((entry) => entry.health === 'connected').length,
      degraded: entries.filter((entry) => entry.health === 'degraded').length,
      disconnected: entries.filter((entry) => entry.health === 'disconnected').length,
    };
  }, [statuses]);

  return { statuses, serviceUrls, summary };
}
