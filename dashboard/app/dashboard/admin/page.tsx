'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';

const SERVICE_TABS = [
  { key: 'paperless', name: 'Paperless', defaultUrl: 'http://localhost:8000', fields: ['token'], labels: { token: 'API Token' }, hint: 'Go to Settings → API Tokens in Paperless to generate one.' },
  { key: 'docuseal', name: 'DocuSeal', defaultUrl: 'http://localhost:3003', fields: ['token'], labels: { token: 'API Token' }, hint: 'Find your API key under Account Settings.' },
  { key: 'invoiceninja', name: 'Invoice Ninja', defaultUrl: 'http://localhost:8080', fields: ['token'], labels: { token: 'API Token' }, hint: 'Settings → Account Management → API Tokens.' },
  { key: 'n8n', name: 'n8n', defaultUrl: 'http://localhost:5678', fields: ['token'], labels: { token: 'API Key' }, hint: 'Settings → API → Create API Key.' },
  { key: 'kimai', name: 'Kimai', defaultUrl: 'http://localhost:8001', fields: ['username', 'token'], labels: { username: 'Email', token: 'API Token' }, hint: 'User menu → API Access to create a token.' },
  { key: 'bigcapital', name: 'Bigcapital', defaultUrl: 'http://localhost:3000', fields: ['token', 'metadata'], labels: { token: 'API Token', metadata: 'Tenant ID' }, hint: 'Check Bigcapital docs for API access.' },
  { key: 'twenty', name: 'Twenty CRM', defaultUrl: 'http://localhost:3004', fields: ['token'], labels: { token: 'API Key' }, hint: 'Settings → Developers → API Keys.' },
  { key: 'metabase', name: 'Metabase', defaultUrl: 'http://localhost:3002', fields: ['username', 'password'], labels: { username: 'Email', password: 'Password' }, hint: 'Use the login email and password you created for this user.' },
  { key: 'mattermost', name: 'Mattermost', defaultUrl: 'http://localhost:8065', fields: ['username', 'password'], labels: { username: 'Username', password: 'Password' }, hint: 'Use the login credentials you created for this user.' },
];

interface Credential {
  service: string;
  token: string | null;
  username: string | null;
  password: string | null;
  metadata: string | null;
}

interface Firm {
  id: string;
  name: string;
  email: string;
}

function AdminContent() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.email === 'admin@maxed.dev' || session?.user?.email === 'admin@maxed.life';
  const searchParams = useSearchParams();
  const firmIdParam = searchParams.get('firmId');

  const [firm, setFirm] = useState<Firm | null>(null);
  const [activeTab, setActiveTab] = useState('paperless');
  const [serviceUrls, setServiceUrls] = useState<Record<string, string>>({});
  const [credentials, setCredentials] = useState<Record<string, Credential>>({});
  const [credForm, setCredForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCredentials = useCallback(async (fId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/firms/${fId}/credentials`));
      if (res.ok) {
        const data = await res.json();
        const credMap: Record<string, Credential> = {};
        data.forEach((c: Credential) => { credMap[c.service] = c; });
        setCredentials(credMap);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    async function init() {
      // Fetch service URLs
      try {
        const res = await fetch(apiUrl('/api/services/urls'));
        if (res.ok) setServiceUrls(await res.json());
      } catch { /* use defaults */ }

      // Fetch firm details
      if (firmIdParam) {
        try {
          const res = await fetch(apiUrl(`/api/firms/${firmIdParam}`));
          if (res.ok) setFirm(await res.json());
        } catch { /* silent */ }
        await fetchCredentials(firmIdParam);
      }
      setLoading(false);
    }
    init();
  }, [firmIdParam, fetchCredentials]);

  // Update form when switching tabs
  useEffect(() => {
    const cred = credentials[activeTab];
    const svc = SERVICE_TABS.find((s) => s.key === activeTab);
    const form: Record<string, string> = {};
    svc?.fields.forEach((f) => { form[f] = ''; });
    if (cred?.username) form.username = cred.username;
    if (cred?.metadata) form.metadata = cred.metadata;
    setCredForm(form);
    setMessage('');
  }, [activeTab, credentials]);

  const handleSave = async () => {
    if (!firmIdParam) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(apiUrl(`/api/firms/${firmIdParam}/credentials/${activeTab}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credForm),
      });
      if (res.ok) {
        setMessage('Saved!');
        fetchCredentials(firmIdParam);
      } else {
        const data = await res.json();
        setMessage(data.error || 'Failed to save.');
      }
    } catch {
      setMessage('Unable to connect.');
    }
    setSaving(false);
  };

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card p-8 text-center text-gray-500">Only administrators can access this page.</div>
      </div>
    );
  }

  if (!firmIdParam) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <p className="text-gray-500 mb-4">Select a CPA firm to set up their services.</p>
          <Link href="/dashboard" className="btn-primary">Go to CPA Firms</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="skeleton h-8 w-64 mb-4" />
        <div className="skeleton h-96 w-full rounded-xl" />
      </div>
    );
  }

  const activeSvc = SERVICE_TABS.find((s) => s.key === activeTab)!;
  const iframeUrl = serviceUrls[activeTab] || activeSvc.defaultUrl;
  const isConfigured = credentials[activeTab] && (credentials[activeTab].token || credentials[activeTab].username);

  return (
    <div className="space-y-4" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Service Setup: {firm?.name || 'Unknown Firm'}
          </h1>
          <p className="text-gray-500 text-sm">
            Create accounts in each service, then save the credentials below
          </p>
        </div>
      </div>

      {/* Service tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {SERVICE_TABS.map((svc) => {
          const configured = credentials[svc.key] && (credentials[svc.key].token || credentials[svc.key].username);
          return (
            <button
              key={svc.key}
              onClick={() => setActiveTab(svc.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === svc.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {configured && (
                <span className={`w-1.5 h-1.5 rounded-full ${activeTab === svc.key ? 'bg-green-300' : 'bg-green-500'}`} />
              )}
              {svc.name}
            </button>
          );
        })}
      </div>

      {/* Two-column layout: iframe + credential form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 18rem)' }}>
        {/* Iframe (2/3 width) */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">
              {activeSvc.name} at <code className="bg-gray-100 px-1 rounded">{iframeUrl}</code>
            </span>
            <a href={iframeUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
              Open in new tab
            </a>
          </div>
          <iframe
            key={activeTab}
            src={iframeUrl}
            className="w-full flex-1 rounded-xl border border-gray-200 bg-white"
            style={{ minHeight: '400px' }}
            title={activeSvc.name}
          />
        </div>

        {/* Credential form (1/3 width) */}
        <div className="card p-5 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-2.5 h-2.5 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-gray-300'}`} />
            <h3 className="text-sm font-semibold text-gray-900">{activeSvc.name} Credentials</h3>
          </div>

          <p className="text-xs text-gray-500 mb-4">{activeSvc.hint}</p>

          <div className="space-y-3">
            {activeSvc.fields.map((field) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {activeSvc.labels[field as keyof typeof activeSvc.labels] || field}
                </label>
                <input
                  className="input text-sm"
                  type={field === 'password' || field === 'token' ? 'password' : 'text'}
                  value={credForm[field] || ''}
                  onChange={(e) => setCredForm({ ...credForm, [field]: e.target.value })}
                  placeholder={isConfigured ? '(leave blank to keep current)' : `Enter ${activeSvc.labels[field as keyof typeof activeSvc.labels] || field}`}
                />
              </div>
            ))}
          </div>

          {message && (
            <p className={`text-xs mt-3 ${message === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>{message}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full mt-4 text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Credentials'}
          </button>

          {isConfigured && (
            <p className="text-xs text-green-600 mt-2 text-center">Credentials saved for this service</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-400 py-12">Loading...</div>}>
      <AdminContent />
    </Suspense>
  );
}
