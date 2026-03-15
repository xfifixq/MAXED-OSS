'use client';

import { useMemo } from 'react';
import ServiceFrame from './ServiceFrame';
import { useServiceStatus } from '@/lib/useServiceStatus';
import { WORKSPACE_CONFIGS } from '@/lib/workspace-config';
import { useFirmReady } from '@/lib/useFirmReady';

function buildWorkspaceUrl(baseUrl: string, firmId: string, targetPath?: string) {
  const target = targetPath || '/';
  return `${baseUrl.replace(/\/$/, '')}/maxed-auth?firmId=${encodeURIComponent(firmId)}&target=${encodeURIComponent(target)}`;
}

export default function ServiceWorkspace({ service }: { service: keyof typeof WORKSPACE_CONFIGS }) {
  const config = WORKSPACE_CONFIGS[service];
  const { serviceUrls, statuses } = useServiceStatus();
  const { firmId, isReady } = useFirmReady();
  const baseUrl = serviceUrls[config.service] || '';
  const status = statuses[config.service];

  const frameUrl = useMemo(() => {
    if (!baseUrl || !firmId) return '';
    return buildWorkspaceUrl(baseUrl, firmId, config.targetPath);
  }, [baseUrl, config.targetPath, firmId]);

  const statusText =
    status?.health === 'connected'
      ? 'Connected'
      : status?.health === 'degraded'
        ? 'Configured'
        : 'Missing setup';
  const statusDot =
    status?.health === 'connected'
      ? 'bg-green-500'
      : status?.health === 'degraded'
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="flex h-full min-h-[calc(100vh-61px)] flex-col bg-white">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`h-2.5 w-2.5 rounded-full ${statusDot}`} />
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">{statusText}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{config.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{config.description}</p>
        </div>
        {baseUrl && (
          <a
            href={frameUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            {config.launchLabel}
          </a>
        )}
      </div>

      {!isReady || !firmId ? (
        <div className="m-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
          Maxed is still resolving the firm session for this workspace.
        </div>
      ) : !baseUrl ? (
        <div className="flex-1" />
      ) : (
        <div className="flex-1 overflow-hidden">
          <ServiceFrame
            src={frameUrl}
            title={config.title}
            fallbackMessage={`Maxed could not open the ${config.title} workspace. Confirm the service is running and the saved credentials are valid.`}
          />
        </div>
      )}
    </div>
  );
}
