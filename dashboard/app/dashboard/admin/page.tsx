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
  checklist: string[];
}

const SERVICE_TABS: ServiceTab[] = [
  {
    key: 'paperless',
    name: 'Paperless',
    defaultUrl: 'https://docs.maxed.life',
    loginPath: '',
    setupMode: 'manual',
    fields: ['username', 'password', 'token'],
    labels: { username: 'Email or Username', password: 'Password', token: 'API Token', metadata: 'Metadata' },
    hint: 'Create or confirm the firm user in Paperless, then save the login and API token here.',
    checklist: [
      'Sign in with the admin dev account.',
      'Create the CPA user manually in Paperless if it does not exist yet.',
      'Generate an API token for that user in the Paperless admin area.',
      'Save the username, password, and token back into Maxed.',
    ],
  },
  {
    key: 'docuseal',
    name: 'DocuSeal',
    defaultUrl: 'https://sign.maxed.life',
    loginPath: '',
    setupMode: 'manual',
    fields: ['username', 'password', 'token'],
    labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Metadata' },
    hint: 'DocuSeal account creation is admin-led for Maxed onboarding. Save the login and API token after provisioning.',
    checklist: [
      'Sign in with the admin account.',
      'Create the CPA user if needed.',
      'Open the API settings for that user and generate a token.',
      'Save the email, password, and API token here.',
    ],
  },
  {
    key: 'invoiceninja',
    name: 'Invoice Ninja',
    defaultUrl: 'https://billing.maxed.life',
    loginPath: '/#/login',
    setupMode: 'manual',
    setupNote: 'Invoice Ninja does not expose staff self-signup here. Its public registration is for the client portal, so the CPA account must be created from the admin billing workspace.',
    fields: ['username', 'password', 'token'],
    labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Metadata' },
    hint: 'Provision the CPA user inside Invoice Ninja, then save the user login and API token.',
    checklist: [
      'Sign in with the admin dev account.',
      'Create the CPA staff user from Invoice Ninja user management.',
      'Create an API token for that user under account or API token settings.',
      'Save the email, password, and API token in Maxed.',
    ],
  },
  {
    key: 'n8n',
    name: 'n8n',
    defaultUrl: 'https://flow.maxed.life',
    loginPath: '',
    setupMode: 'manual',
    fields: ['token'],
    labels: { username: 'Username', password: 'Password', token: 'API Key', metadata: 'Metadata' },
    hint: 'Store the n8n API key used for this firm workspace.',
    checklist: [
      'Sign in to n8n with the admin account.',
      'Create or copy the API key for the workspace.',
      'Save the API key into Maxed.',
    ],
  },
  {
    key: 'kimai',
    name: 'Kimai',
    defaultUrl: 'https://time.maxed.life',
    loginPath: '',
    setupMode: 'manual',
    setupNote: 'Kimai self-registration is not dependable for this stack. Provision the CPA user from the admin account, then generate that user API token.',
    fields: ['username', 'password', 'token'],
    labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Metadata' },
    hint: 'Create the Kimai user from the admin account and save the login plus API token.',
    checklist: [
      'Sign in with the Kimai admin account.',
      'Create the CPA user manually in Kimai administration.',
      'Open that user profile and generate an API token.',
      'Save the email, password, and token here.',
    ],
  },
  {
    key: 'bigcapital',
    name: 'Bigcapital',
    defaultUrl: 'https://books.maxed.life',
    loginPath: '/auth/login',
    registerPath: '/auth/register',
    setupMode: 'signup',
    signupNote: 'Bigcapital exposes a direct register route, and Maxed now proxies its API correctly. If the firm signup page was buffering forever before, that was a platform routing problem rather than a user error.',
    fields: ['username', 'password', 'token', 'metadata'],
    labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Tenant ID' },
    hint: 'Create the firm organization, then save the workspace login, tenant ID, and API token.',
    checklist: [
      'Open the Bigcapital sign-up route to create the organization workspace.',
      'If the firm already exists, sign in and create the CPA user from Bigcapital admin.',
      'Capture the tenant ID and API token for that workspace.',
      'Save the email, password, API token, and tenant ID in Maxed.',
    ],
  },
  {
    key: 'twenty',
    name: 'Twenty CRM',
    defaultUrl: 'https://crm.maxed.life',
    loginPath: '',
    registerPath: '/sign-up',
    setupMode: 'signup',
    signupNote: 'Twenty supports direct signup, so this setup can stay on the create-account flow.',
    fields: ['username', 'password', 'token'],
    labels: { username: 'Email', password: 'Password', token: 'API Key', metadata: 'Metadata' },
    hint: 'Create the workspace user, then save the login and API key.',
    checklist: [
      'Open the Twenty sign-up page.',
      'Create the CPA workspace user.',
      'Generate or copy the API key for that user.',
      'Save the email, password, and API key in Maxed.',
    ],
  },
  {
    key: 'metabase',
    name: 'Metabase',
    defaultUrl: 'https://reports.maxed.life',
    loginPath: '/auth/login',
    setupMode: 'manual',
    setupNote: 'Metabase does not expose normal public self-signup. Invite the CPA user from Admin > People or provision it directly from the admin account.',
    fields: ['username', 'password'],
    labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Metadata' },
    hint: 'Invite the CPA user in Metabase, then save the login here.',
    checklist: [
      'Sign in with the Metabase admin account.',
      'Invite the CPA user from the People or Admin area.',
      'Have the invited user finish password setup, or reset the password manually if needed.',
      'Save the email and password in Maxed.',
    ],
  },
  {
    key: 'mattermost',
    name: 'Mattermost',
    defaultUrl: 'https://chat.maxed.life',
    loginPath: '/login',
    registerPath: '/signup_email',
    setupMode: 'signup',
    signupNote: 'Mattermost email signup is now explicitly enabled in the container config. If you prefer controlled provisioning, you can still create the CPA user from the system admin account and then save those credentials here.',
    fields: ['username', 'password'],
    labels: { username: 'Username or Email', password: 'Password', token: 'API Token', metadata: 'Metadata' },
    hint: 'Create the CPA user in Mattermost, add the user to the right team or channels, then save the login used for that workspace.',
    checklist: [
      'Try the dedicated email signup route if you want self-service account creation.',
      'If you are onboarding centrally, sign in as system admin and create the CPA user manually.',
      'Assign the user to the proper team and channels.',
      'Save the username or email and password back into Maxed.',
    ],
  },
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

type ServiceHealth = 'connected' | 'degraded' | 'disconnected' | 'unknown';

type ServiceStatusEntry = {
  configured: boolean;
  health: ServiceHealth;
};

function buildServiceUrl(baseUrl: string, path = '') {
  if (!path) return baseUrl;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function AdminContent() {
  const { data: session } = useSession();
  const isAdmin = Boolean((session?.user as { isPlatformAdmin?: boolean } | undefined)?.isPlatformAdmin);
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
  const [serviceStatus, setServiceStatus] = useState<Record<string, ServiceStatusEntry>>({});

  const fetchCredentials = useCallback(async (firmId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/firms/${firmId}/credentials`));
      if (!res.ok) return;
      const data = (await res.json()) as Credential[];
      const credMap: Record<string, Credential> = {};
      data.forEach((credential) => {
        credMap[credential.service] = credential;
      });
      setCredentials(credMap);
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
  }, [fetchCredentials, firmIdParam]);

  const fetchServiceStatus = useCallback(async (firmId: string) => {
    try {
      const [statusRes, diagnoseRes] = await Promise.all([
        fetch(apiUrl('/api/services/status')),
        fetch(apiUrl('/api/services/diagnose'), {
          headers: { 'X-Firm-Id': firmId },
        }),
      ]);

      const statusJson = statusRes.ok ? await statusRes.json() : {};
      const diagnoseJson = diagnoseRes.ok ? await diagnoseRes.json() : {};

      const nextStatus = SERVICE_TABS.reduce<Record<string, ServiceStatusEntry>>((acc, service) => {
        const configured = Boolean(diagnoseJson?.[service.key]?.configured);
        let health: ServiceHealth = 'unknown';

        if (!configured) {
          health = 'disconnected';
        } else if (statusJson?.[service.key]?.status === 'connected') {
          health = 'connected';
        } else if (statusJson?.[service.key]?.status === 'unavailable') {
          health = 'degraded';
        }

        acc[service.key] = { configured, health };
        return acc;
      }, {});

      setServiceStatus(nextStatus);
    } catch {
      setServiceStatus({});
    }
  }, []);

  useEffect(() => {
    if (!firmIdParam) return;
    fetchServiceStatus(firmIdParam);
  }, [fetchServiceStatus, firmIdParam]);

  useEffect(() => {
    const credential = credentials[activeTab];
    const service = SERVICE_TABS.find((item) => item.key === activeTab);
    const nextForm: Record<string, string> = {};

    service?.fields.forEach((field) => {
      nextForm[field] = '';
    });

    if (credential?.username) nextForm.username = credential.username;
    if (credential?.metadata) nextForm.metadata = credential.metadata;

    setCredForm(nextForm);
    setShowRegister(service?.setupMode === 'signup');
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

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setMessage(data.error || 'Failed to save.');
        return;
      }

      setMessage('Saved!');
      fetchCredentials(firmIdParam);
    } catch {
      setMessage('Unable to connect.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="card p-8 text-center text-gray-500">Only administrators can access this page.</div>
      </div>
    );
  }

  if (!firmIdParam) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="card p-8 text-center">
          <p className="mb-4 text-gray-500">Select a CPA firm to set up their services.</p>
          <Link href="/dashboard" className="btn-primary">Go to CPA Firms</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="skeleton mb-4 h-8 w-64" />
        <div className="skeleton h-96 w-full rounded-xl" />
      </div>
    );
  }

  const activeSvc = SERVICE_TABS.find((item) => item.key === activeTab)!;
  const baseUrl = serviceUrls[activeTab] || activeSvc.defaultUrl;
  const canRegister = activeSvc.setupMode === 'signup' && Boolean(activeSvc.registerPath);
  const loginUrl = buildServiceUrl(baseUrl, activeSvc.loginPath);
  const registerUrl = activeSvc.registerPath ? buildServiceUrl(baseUrl, activeSvc.registerPath) : '';
  const iframeUrl = buildServiceUrl(
    baseUrl,
    showRegister && activeSvc.registerPath ? activeSvc.registerPath : activeSvc.loginPath,
  );
  const isConfigured = Boolean(
    credentials[activeTab] &&
    (credentials[activeTab].token || credentials[activeTab].username || credentials[activeTab].password),
  );
  const activeStatus = serviceStatus[activeTab];
  const readinessSummary = SERVICE_TABS.reduce(
    (summary, service) => {
      const entry = serviceStatus[service.key];
      if (!entry || entry.health === 'unknown') summary.unknown += 1;
      else if (entry.health === 'connected') summary.connected += 1;
      else if (entry.health === 'degraded') summary.degraded += 1;
      else summary.disconnected += 1;
      return summary;
    },
    { connected: 0, degraded: 0, disconnected: 0, unknown: 0 },
  );
  const cpaReadyCore = ['paperless', 'docuseal', 'invoiceninja', 'kimai', 'bigcapital', 'metabase', 'mattermost'];
  const cpaReadyCount = cpaReadyCore.filter((key) => serviceStatus[key]?.health === 'connected').length;
  const cpaReady = cpaReadyCount === cpaReadyCore.length;

  const statusLabel = (health?: ServiceHealth) => {
    switch (health) {
      case 'connected':
        return 'Connected';
      case 'degraded':
        return 'Configured';
      case 'disconnected':
        return 'Needs setup';
      default:
        return 'Unknown';
    }
  };

  const statusTone = (health?: ServiceHealth) => {
    switch (health) {
      case 'connected':
        return 'bg-green-100 text-green-700';
      case 'degraded':
        return 'bg-amber-100 text-amber-700';
      case 'disconnected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Service Setup: {firm?.name || 'Unknown Firm'}</h1>
          <p className="text-sm text-gray-500">Provision each upstream account correctly, then save the credentials inside Maxed.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">CPA readiness</p>
          <p className={`mt-2 text-lg font-semibold ${cpaReady ? 'text-green-600' : 'text-amber-600'}`}>
            {cpaReady ? 'Core stack ready' : `${cpaReadyCount}/${cpaReadyCore.length} core services live`}
          </p>
          <p className="mt-1 text-sm text-slate-500">Paperless, Sign, Billing, Time, Books, Reports, Chat</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Connected</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{readinessSummary.connected}</p>
          <p className="mt-1 text-sm text-slate-500">Healthy firm-scoped services</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Needs attention</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{readinessSummary.degraded + readinessSummary.disconnected}</p>
          <p className="mt-1 text-sm text-slate-500">Configured or missing services</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unknown</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{readinessSummary.unknown}</p>
          <p className="mt-1 text-sm text-slate-500">Not yet diagnosed in this view</p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {SERVICE_TABS.map((service) => {
          const entry = serviceStatus[service.key];
          const configured = entry?.configured || Boolean(
            credentials[service.key] &&
            (credentials[service.key].token || credentials[service.key].username || credentials[service.key].password),
          );

          return (
            <button
              key={service.key}
              onClick={() => {
                setActiveTab(service.key);
                setShowRegister(service.setupMode === 'signup');
              }}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === service.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {configured ? (
                <span className={`h-1.5 w-1.5 rounded-full ${
                  entry?.health === 'connected'
                    ? activeTab === service.key ? 'bg-green-300' : 'bg-green-500'
                    : entry?.health === 'degraded'
                      ? activeTab === service.key ? 'bg-amber-200' : 'bg-amber-500'
                      : activeTab === service.key ? 'bg-red-200' : 'bg-red-500'
                }`} />
              ) : null}
              {service.name}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {activeSvc.name} at <code className="rounded bg-gray-100 px-1">{iframeUrl}</code>
                  </span>
                  {canRegister ? (
                    <div className="overflow-hidden rounded-md border border-gray-200 text-xs">
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
                  ) : null}
                  <button
                    onClick={() => setIframeVisible((current) => !current)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700"
                  >
                    {iframeVisible ? 'Hide embed' : 'Show embed'}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  If the embedded app blocks framing or is not the right place to provision users, use the external launch buttons and follow the setup checklist on the right.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <a href={baseUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                  Open service
                </a>
                {activeSvc.loginPath !== undefined ? (
                  <a href={loginUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                    Open login
                  </a>
                ) : null}
                {registerUrl ? (
                  <a href={registerUrl} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">
                    Open sign up
                  </a>
                ) : null}
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
              Embedded view hidden. Use the external launch buttons above and the setup checklist on the right to complete provisioning.
            </div>
          )}
        </div>

        <div className="card h-fit p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${
              activeStatus?.health === 'connected'
                ? 'bg-green-500'
                : activeStatus?.health === 'degraded'
                  ? 'bg-amber-500'
                  : isConfigured
                    ? 'bg-blue-500'
                    : 'bg-gray-300'
            }`} />
            <h3 className="text-sm font-semibold text-gray-900">{activeSvc.name} Setup</h3>
          </div>

          <div className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusTone(activeStatus?.health)}`}>
            {statusLabel(activeStatus?.health)}
          </div>

          <p className="mb-4 text-xs text-gray-500">{activeSvc.hint}</p>

          {(activeSvc.signupNote || activeSvc.setupNote) ? (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              {activeSvc.signupNote || activeSvc.setupNote}
            </div>
          ) : null}

          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Provisioning checklist</p>
            <ol className="mt-3 space-y-2 text-sm text-slate-700">
              {activeSvc.checklist.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Go / No-Go</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li className="flex items-center justify-between gap-3">
                <span>Credentials saved in Maxed</span>
                <span className={isConfigured ? 'badge-green' : 'badge-yellow'}>{isConfigured ? 'Yes' : 'No'}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Service reachable</span>
                <span className={activeStatus?.health === 'connected' ? 'badge-green' : activeStatus?.health === 'degraded' ? 'badge-yellow' : 'badge'}>
                  {activeStatus?.health === 'connected' ? 'Healthy' : activeStatus?.health === 'degraded' ? 'Degraded' : 'Unknown'}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Ready for CPA handoff</span>
                <span className={activeStatus?.health === 'connected' && isConfigured ? 'badge-green' : 'badge-yellow'}>
                  {activeStatus?.health === 'connected' && isConfigured ? 'Ready' : 'Not ready'}
                </span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            {activeSvc.fields.map((field) => (
              <div key={field}>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {activeSvc.labels[field]}
                </label>
                <input
                  className="input text-sm"
                  type={field === 'password' || field === 'token' ? 'password' : 'text'}
                  value={credForm[field] || ''}
                  onChange={(event) => setCredForm({ ...credForm, [field]: event.target.value })}
                  placeholder={isConfigured ? '(leave blank to keep current)' : `Enter ${activeSvc.labels[field]}`}
                />
              </div>
            ))}
          </div>

          {message ? (
            <p className={`mt-3 text-xs ${message === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>{message}</p>
          ) : null}

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary mt-4 w-full text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Credentials'}
          </button>

          {isConfigured ? (
            <p className="mt-2 text-center text-xs text-green-600">Credentials saved for this service</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-400">Loading...</div>}>
      <AdminContent />
    </Suspense>
  );
}
