'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';

type ServiceField = 'username' | 'password' | 'token' | 'metadata';
type SetupMode = 'manual' | 'signup';

interface ServiceTab {
  key: string;
  name: string;
  defaultUrl: string;
  loginPath?: string;
  registerPath?: string;
  setupMode: SetupMode;
  signupNote?: string;
  setupNote?: string;
  fields: ServiceField[];
  labels: Record<ServiceField, string>;
  hint: string;
}

const SERVICE_TABS: ServiceTab[] = [
  { key: 'paperless', name: 'Paperless', defaultUrl: 'https://docs.maxed.life', loginPath: '', setupMode: 'manual', fields: ['username', 'password', 'token'], labels: { username: 'Email or Username', password: 'Password', token: 'API Token', metadata: 'Metadata' }, hint: 'Log in as the service admin, create the firm user manually, then generate and save that user API token.' },
  { key: 'docuseal', name: 'DocuSeal', defaultUrl: 'https://sign.maxed.life', loginPath: '', setupMode: 'manual', fields: ['username', 'password', 'token'], labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Metadata' }, hint: 'Log in as the service admin, create the firm user if needed, then save the login and API token.' },
  { key: 'invoiceninja', name: 'Invoice Ninja', defaultUrl: 'https://billing.maxed.life', loginPath: '/#/login', setupMode: 'manual', setupNote: 'Invoice Ninja does not expose a staff self-signup flow here. Its public registration is for the client portal, so create the CPA user from the admin account inside Invoice Ninja.', fields: ['username', 'password', 'token'], labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Metadata' }, hint: 'Create the CPA user inside Invoice Ninja, then save that login and API token here.' },
  { key: 'n8n', name: 'n8n', defaultUrl: 'https://flow.maxed.life', loginPath: '', setupMode: 'manual', fields: ['token'], labels: { username: 'Username', password: 'Password', token: 'API Key', metadata: 'Metadata' }, hint: 'Log in as admin and create or copy the API key for this firm workspace.' },
  { key: 'kimai', name: 'Kimai', defaultUrl: 'https://time.maxed.life', loginPath: '', setupMode: 'signup', setupNote: 'Kimai supports self-registration from the login screen only when registration is enabled and email delivery is configured. If the sign-up link is missing, the instance still needs that server-side setup.', fields: ['username', 'password', 'token'], labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Metadata' }, hint: 'Use the sign-up link on the Kimai login page when available, otherwise create the CPA user from the Kimai admin account.' },
  { key: 'bigcapital', name: 'Bigcapital', defaultUrl: 'https://books.maxed.life', loginPath: '/auth/login', registerPath: '/auth/register', setupMode: 'signup', signupNote: 'Bigcapital exposes a direct register page at `/auth/register`, so the Sign Up tab now opens that route.', fields: ['username', 'password', 'token', 'metadata'], labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Tenant ID' }, hint: 'Create the firm organization, then save the workspace login, tenant ID, and API token.' },
  { key: 'twenty', name: 'Twenty CRM', defaultUrl: 'https://crm.maxed.life', loginPath: '', registerPath: '/sign-up', setupMode: 'signup', signupNote: 'Twenty supports direct signup, so the embedded view can stay on the create-account flow.', fields: ['username', 'password', 'token'], labels: { username: 'Email', password: 'Password', token: 'API Key', metadata: 'Metadata' }, hint: 'Create the workspace user, then save the login and API key.' },
  { key: 'metabase', name: 'Metabase', defaultUrl: 'https://reports.maxed.life', loginPath: '/auth/login', setupMode: 'manual', setupNote: 'Metabase does not have normal public self-signup. Add the CPA user under Admin > People > Invite someone, or use SSO if you want self-provisioning.', fields: ['username', 'password'], labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Metadata' }, hint: 'Invite the CPA user in Metabase, then save the login here.' },
  { key: 'mattermost', name: 'Mattermost', defaultUrl: 'https://chat.maxed.life', loginPath: '/login', registerPath: '/signup_email', setupMode: 'signup', signupNote: 'Mattermost account creation is controlled by open-server and email-signup settings. The Sign Up tab now targets the dedicated email signup route.', fields: ['username', 'password'], labels: { username: 'Username or Email', password: 'Password', token: 'API Token', metadata: 'Metadata' }, hint: 'Create the CPA user in Mattermost, then save the login used for that workspace.' },
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

function buildServiceUrl(baseUrl: string, path = '') {
  if (!path) return baseUrl;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function AdminContent() {
  const { data: session } = useSession();
  const isAdmin = Boolean((session?.user as any)?.isPlatformAdmin);
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
  const [showRegister, setShowRegister] = useState(false);
  const [iframeVisible, setIframeVisible] = useState(true);

  const fetchCredentials = useCallback(async (fId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/firms/${fId}/credentials`));
      if (res.ok) {
        const data = await res.json();
        const credMap: Record<string, Credential> = {};
        data.forEach((c: Credential) => { credMap[c.service] = c; });
        setCredentials(credMap);
      }
    } catch {}
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(apiUrl('/api/services/urls'));
        if (res.ok) setServiceUrls(await res.json());
      } catch {}

      if (firmIdParam) {
        try {
          const res = await fetch(apiUrl(`/api/firms/${firmIdParam}`));
          if (res.ok) setFirm(await res.json());
        } catch {}
        await fetchCredentials(firmIdParam);
      }
      setLoading(false);
    }
    init();
  }, [firmIdParam, fetchCredentials]);

  useEffect(() => {
    const cred = credentials[activeTab];
    const svc = SERVICE_TABS.find((s) => s.key === activeTab);
    const form: Record<string, string> = {};
    svc?.fields.forEach((f) => { form[f] = ''; });
    if (cred?.username) form.username = cred.username;
    if (cred?.metadata) form.metadata = cred.metadata;
    setCredForm(form);
    setShowRegister(svc?.setupMode === 'signup');
    setIframeVisible(true);
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
  const baseUrl = serviceUrls[activeTab] || activeSvc.defaultUrl;
  const canRegister = activeSvc.setupMode === 'signup' && !!activeSvc.registerPath;
  const loginUrl = buildServiceUrl(baseUrl, activeSvc.loginPath);
  const registerUrl = activeSvc.registerPath ? buildServiceUrl(baseUrl, activeSvc.registerPath) : '';
  const iframeUrl = buildServiceUrl(
    baseUrl,
    showRegister && activeSvc.registerPath ? activeSvc.registerPath : activeSvc.loginPath
  );
  const isConfigured = Boolean(credentials[activeTab] && (credentials[activeTab].token || credentials[activeTab].username || credentials[activeTab].password));

  return (
    <div className="space-y-4">
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

      <div className="flex gap-1 overflow-x-auto pb-1">
        {SERVICE_TABS.map((svc) => {
          const configured = Boolean(credentials[svc.key] && (credentials[svc.key].token || credentials[svc.key].username || credentials[svc.key].password));
          return (
            <button
              key={svc.key}
              onClick={() => {
                setActiveTab(svc.key);
                setShowRegister(svc.setupMode === 'signup');
              }}
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {activeSvc.name} at <code className="bg-gray-100 px-1 rounded">{iframeUrl}</code>
                  </span>
                  {canRegister && (
                    <div className="flex items-center rounded-md border border-gray-200 overflow-hidden text-xs">
                      <button
                        onClick={() => setShowRegister(true)}
                        className={`px-2.5 py-1 font-medium transition-colors ${showRegister ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                      >
                        Sign Up
                      </button>
                      <button
                        onClick={() => setShowRegister(false)}
                        className={`px-2.5 py-1 font-medium transition-colors ${!showRegister ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                      >
                        Log In
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setIframeVisible((current) => !current)}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                  >
                    {iframeVisible ? 'Hide embed' : 'Show embed'}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  If the service blocks embedding or renders a blank frame, use the external launch buttons below and save the credentials back in Maxed after setup.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <a href={baseUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                  Open service
                </a>
                {activeSvc.loginPath !== undefined && (
                  <a href={loginUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                    Open login
                  </a>
                )}
                {registerUrl && (
                  <a href={registerUrl} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">
                    Open sign up
                  </a>
                )}
              </div>
            </div>
          </div>

          {iframeVisible ? (
            <iframe
              key={`${activeTab}-${showRegister}`}
              src={iframeUrl}
              className="w-full rounded-xl border border-gray-200 bg-white"
              style={{ minHeight: '70vh' }}
              title={activeSvc.name}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
              Embedded view hidden. Use the external launch buttons above to complete setup and then save the credentials on the right.
            </div>
          )}
        </div>

        <div className="card p-5 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-2.5 h-2.5 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-gray-300'}`} />
            <h3 className="text-sm font-semibold text-gray-900">{activeSvc.name} Credentials</h3>
          </div>

          <p className="text-xs text-gray-500 mb-4">{activeSvc.hint}</p>
          {(activeSvc.signupNote || activeSvc.setupNote) && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              {activeSvc.signupNote || activeSvc.setupNote}
            </div>
          )}

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
