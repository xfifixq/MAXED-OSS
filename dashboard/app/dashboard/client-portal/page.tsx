'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiUrl } from '@/lib/api';

interface PortalAccess {
  firmId: string;
  firmName: string;
  portalAccessCode: string | null;
  portalUrl: string;
}

export default function ClientPortalPage() {
  const { data: session } = useSession();
  const firmId = (session?.user as any)?.firmId;
  const [portalAccess, setPortalAccess] = useState<PortalAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadPortalAccess() {
      if (!firmId) return;
      try {
        const res = await fetch(apiUrl(`/api/firms/${firmId}/portal-access`));
        if (!res.ok) throw new Error(`Unable to load portal access (${res.status})`);
        setPortalAccess(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load portal access.');
      } finally {
        setLoading(false);
      }
    }

    loadPortalAccess();
  }, [firmId]);

  const portalUrl = portalAccess?.portalUrl || (process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || 'https://portal.maxed.life');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
        <p className="text-sm text-gray-500 mt-1">
          Share this portal link and access code with clients so they can log in and exchange documents, invoices, proposals, and messages.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Portal Access</h2>
          <p className="mt-2 text-sm text-gray-500">
            Give clients this link and the access code below.
          </p>

          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Portal URL</p>
            <p className="mt-2 break-all text-sm font-medium text-gray-900">{portalUrl}</p>
            <p className="mt-2 text-xs text-gray-500">
              This is a client-facing surface. CPA users should stay in Maxed unless they are verifying the client experience.
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Access Code</p>
            <p className="mt-2 text-2xl font-bold tracking-[0.18em] text-gray-900">
              {loading ? 'Loading...' : portalAccess?.portalAccessCode || 'Unavailable'}
            </p>
          </div>

          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-4 inline-flex"
          >
            Open Client Portal
          </a>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Portal Capabilities</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>Secure document upload and retrieval</li>
            <li>Invoice review and payment status</li>
            <li>Proposal review and signature flow</li>
            <li>Client messaging and questions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
