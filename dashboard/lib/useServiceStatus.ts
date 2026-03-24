'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiUrl, serviceHeaders } from './api';
import { useFirmReady } from './useFirmReady';

export type ServiceHealth = 'connected' | 'degraded' | 'disconnected' | 'unknown';

type LiveProbe = {
  ok?: boolean;
  status?: number;
  reason?: string;
  detail?: unknown;
};

export interface ServiceStatusEntry {
  key: string;
  configured: boolean;
  source: 'firm' | 'env' | 'none';
  health: ServiceHealth;
  code?: number;
  reason?: string;
  detail?: string;
  workspacePath?: string;
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

function stringifyDetail(detail: unknown) {
  if (detail == null) return undefined;
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'number' || typeof detail === 'boolean') return String(detail);
  if (typeof detail === 'object') {
    return Object.entries(detail as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ');
  }
  return undefined;
}

export function useServiceStatus() {
  const { isReady, firmId } = useFirmReady();
  const [statuses, setStatuses] = useState<Record<string, ServiceStatusEntry>>({});
  const [serviceUrls, setServiceUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function fetchStatuses() {
      try {
        const urlsRes = await fetch(apiUrl('/api/control-plane/urls'));
        const urlsJson = (urlsRes.ok ? await urlsRes.json() : {}) as Record<string, string>;

        let nextStatuses: Record<string, ServiceStatusEntry> = {};

        if (firmId) {
          const controlPlaneRes = await fetch(apiUrl(`/api/firms/${firmId}/control-plane/services`), {
            headers: serviceHeaders(),
          });

          if (controlPlaneRes.ok) {
            const controlPlaneJson = (await controlPlaneRes.json()) as {
              services?: Record<string, {
                key?: string;
                configured?: boolean;
                source?: 'firm' | 'env' | 'none';
                workspacePath?: string;
                liveProbe?: LiveProbe;
              }>;
            };

            nextStatuses = SERVICE_KEYS.reduce<Record<string, ServiceStatusEntry>>((acc, key) => {
              const service = controlPlaneJson?.services?.[key];
              const configured = Boolean(service?.configured);
              const liveProbe = service?.liveProbe;
              const health: ServiceHealth = !configured
                ? 'disconnected'
                : liveProbe?.ok
                  ? 'connected'
                  : 'degraded';

              acc[key] = {
                key,
                configured,
                source: service?.source || 'firm',
                health,
                code: liveProbe?.status,
                reason: liveProbe?.reason,
                detail: stringifyDetail(liveProbe?.detail),
                workspacePath: service?.workspacePath,
              };
              return acc;
            }, {});
          }
        }

        if (!Object.keys(nextStatuses).length) {
          const [statusRes, diagnoseRes] = await Promise.all([
            fetch(apiUrl('/api/control-plane/status')),
            firmId
              ? fetch(apiUrl('/api/control-plane/diagnose'), { headers: serviceHeaders() })
              : Promise.resolve(null),
          ]);
          const statusJson = (statusRes.ok ? await statusRes.json() : {}) as Record<string, any>;
          const diagnoseJson = (diagnoseRes && diagnoseRes.ok ? await diagnoseRes.json() : {}) as Record<string, any>;

          nextStatuses = SERVICE_KEYS.reduce<Record<string, ServiceStatusEntry>>((acc, key) => {
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
        }

        if (!active) return;

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
