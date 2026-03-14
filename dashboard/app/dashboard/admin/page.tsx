'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { apiUrl } from '@/lib/api';

const SERVICE_TABS = [
  { key: 'paperless', name: 'Paperless', defaultUrl: 'http://localhost:8000' },
  { key: 'docuseal', name: 'DocuSeal', defaultUrl: 'http://localhost:3003' },
  { key: 'invoiceninja', name: 'Invoice Ninja', defaultUrl: 'http://localhost:8080' },
  { key: 'n8n', name: 'n8n', defaultUrl: 'http://localhost:5678' },
  { key: 'kimai', name: 'Kimai', defaultUrl: 'http://localhost:8001' },
  { key: 'bigcapital', name: 'Bigcapital', defaultUrl: 'http://localhost:3000' },
  { key: 'twenty', name: 'Twenty CRM', defaultUrl: 'http://localhost:3004' },
  { key: 'metabase', name: 'Metabase', defaultUrl: 'http://localhost:3002' },
  { key: 'mattermost', name: 'Mattermost', defaultUrl: 'http://localhost:8065' },
];

export default function AdminPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.email === 'admin@maxed.dev' || session?.user?.email === 'admin@maxed.life';

  const [activeTab, setActiveTab] = useState('paperless');
  const [serviceUrls, setServiceUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUrls() {
      try {
        const res = await fetch(apiUrl('/api/services/urls'));
        if (res.ok) {
          setServiceUrls(await res.json());
        }
      } catch { /* use defaults */ }
      setLoading(false);
    }
    fetchUrls();
  }, []);

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card p-8 text-center text-gray-500">
          Only administrators can access this page.
        </div>
      </div>
    );
  }

  const activeService = SERVICE_TABS.find((s) => s.key === activeTab);
  const iframeUrl = serviceUrls[activeTab] || activeService?.defaultUrl || '';

  return (
    <div className="space-y-4" style={{ height: 'calc(100vh - 8rem)' }}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin - Service Setup</h1>
        <p className="text-gray-500 text-sm mt-1">
          Create accounts on each service for CPA firms, then save the credentials in Settings.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {SERVICE_TABS.map((svc) => (
          <button
            key={svc.key}
            onClick={() => setActiveTab(svc.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === svc.key
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {svc.name}
          </button>
        ))}
      </div>

      {/* Open in new tab link */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-500">
          {activeService?.name} at <code className="bg-gray-100 px-1 rounded text-xs">{iframeUrl}</code>
        </span>
        <a
          href={iframeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 hover:text-brand-700 font-medium"
        >
          Open in new tab
        </a>
      </div>

      {/* Iframe */}
      {loading ? (
        <div className="flex-1 bg-gray-100 rounded-xl flex items-center justify-center" style={{ minHeight: '60vh' }}>
          <p className="text-gray-400">Loading service URLs...</p>
        </div>
      ) : (
        <iframe
          key={activeTab}
          src={iframeUrl}
          className="w-full rounded-xl border border-gray-200 bg-white"
          style={{ height: 'calc(100vh - 16rem)' }}
          title={activeService?.name}
        />
      )}
    </div>
  );
}
