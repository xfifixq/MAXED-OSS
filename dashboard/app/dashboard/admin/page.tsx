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
  adminPath?: string;
  setupPath?: string;
  recommendedPath?: string;
  embedPreferred?: boolean;
  setupMode: SetupMode;
  signupNote?: string;
  setupNote?: string;
  fields: ServiceField[];
  labels: Record<ServiceField, string>;
  hint: string;
  accountModel: string;
  checklist: string[];
}

const SERVICE_TABS: ServiceTab[] = [
  {
    key: 'paperless',
    name: 'Paperless',
    defaultUrl: 'https://docs.maxed.life',
    loginPath: '',
    adminPath: '',
    recommendedPath: '',
    embedPreferred: true,
    setupMode: 'manual',
    fields: ['username', 'password', 'token'],
    labels: { username: 'Email or Username', password: 'Password', token: 'API Token', metadata: 'Metadata' },
    hint: 'Create or confirm the firm user in Paperless, then save the login and API token here.',
    accountModel: 'Admin creates or confirms the firm user, then Maxed stores the credentials.',
    checklist: [
      'Sign in with the service admin account.',
      'Create or confirm the CPA user in Paperless.',
      'Generate an API token for that user in the Paperless admin area.',
      'Save the username, password, and token back into Maxed.',
    ],
  },
  {
    key: 'docuseal',
    name: 'DocuSeal',
    defaultUrl: 'https://sign.maxed.life',
    loginPath: '',
    adminPath: '',
    recommendedPath: '',
    embedPreferred: true,
    setupMode: 'manual',
    fields: ['username', 'password', 'token'],
    labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Metadata' },
    hint: 'DocuSeal account creation is admin-led for Maxed onboarding. Save the login and API token after provisioning.',
    accountModel: 'Admin creates or confirms the firm user, then Maxed stores the credentials.',
    checklist: [
      'Sign in with the service admin account.',
      'Create or confirm the CPA user.',
      'Open the API settings for that user and generate a token.',
      'Save the email, password, and API token here.',
    ],
  },
  {
    key: 'invoiceninja',
    name: 'Invoice Ninja',
    defaultUrl: 'https://billing.maxed.life',
    loginPath: '/#/login',
    adminPath: '/#/settings/user_management',
    setupPath: '/setup',
    recommendedPath: '/#/settings/user_management',
    embedPreferred: false,
    setupMode: 'manual',
    setupNote: 'Invoice Ninja does not expose staff self-signup here. If the instance is not initialized yet, use the initial setup flow first. After that, create CPA staff users from User Management.',
    fields: ['username', 'password', 'token'],
    labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Metadata' },
    hint: 'Provision the CPA user inside Invoice Ninja, then save the user login and API token.',
    accountModel: 'Invoice Ninja runs from a shared admin account first, then each CPA gets a staff user.',
    checklist: [
      'If the instance is fresh, finish Invoice Ninja setup first.',
      'Sign in with the admin account.',
      'Create or confirm the CPA staff user from User Management.',
      'Create an API token for that user under account or API token settings.',
      'Save the email, password, and API token in Maxed.',
    ],
  },
  {
    key: 'n8n',
    name: 'n8n',
    defaultUrl: 'https://flow.maxed.life',
    loginPath: '',
    registerPath: '/setup',
    adminPath: '',
    recommendedPath: '/setup',
    embedPreferred: true,
    setupMode: 'signup',
    fields: ['token'],
    labels: { username: 'Username', password: 'Password', token: 'API Key', metadata: 'Metadata' },
    hint: 'Complete the n8n owner setup flow if needed, then store the API key used for this firm workspace.',
    accountModel: 'Fresh instances create an owner first; after that Maxed stores the workspace API key.',
    checklist: [
      'If this is a fresh instance, complete the owner setup flow.',
      'Sign in with the owner account.',
      'Create or copy the API key for the workspace.',
      'Save the API key into Maxed.',
    ],
  },
  {
    key: 'kimai',
    name: 'Kimai',
    defaultUrl: 'https://time.maxed.life',
    loginPath: '',
    adminPath: '/en/admin/user/',
    recommendedPath: '/en/admin/user/',
    embedPreferred: false,
    setupMode: 'manual',
    setupNote: 'Kimai can create the first user either from the login/register screen or via the server command line. After the first super admin exists, create additional CPA users from Kimai administration.',
    fields: ['username', 'password', 'token'],
    labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Metadata' },
    hint: 'Create the Kimai user from the admin account and save the login plus API token.',
    accountModel: 'Kimai uses one seeded admin first; that admin creates each CPA user.',
    checklist: [
      'If no Kimai admin exists yet, create the first super admin from the login/register screen or via the Kimai CLI command documented upstream.',
      'Sign in with the Kimai admin account.',
      'Create or confirm the CPA user in Kimai administration.',
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
    adminPath: '/admin/users',
    recommendedPath: '/auth/register',
    embedPreferred: true,
    setupMode: 'signup',
    signupNote: 'Bigcapital exposes a direct register route, and Maxed now proxies its API correctly. If the firm signup page was buffering forever before, that was a platform routing problem rather than a user error.',
    fields: ['username', 'password', 'token', 'metadata'],
    labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Tenant ID' },
    hint: 'Create the firm organization, then save the workspace login, tenant ID, and API token.',
    accountModel: 'Bigcapital can sign up directly or have users managed by an existing admin.',
    checklist: [
      'Open the recommended setup route to create or access the firm workspace.',
      'If the firm already exists, create or confirm the CPA user from Bigcapital admin.',
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
    adminPath: '',
    recommendedPath: '/sign-up',
    embedPreferred: true,
    setupMode: 'signup',
    signupNote: 'Twenty supports direct signup, so this setup can stay on the create-account flow.',
    fields: ['username', 'password', 'token'],
    labels: { username: 'Email', password: 'Password', token: 'API Key', metadata: 'Metadata' },
    hint: 'Create the workspace user, then save the login and API key.',
    accountModel: 'Each CPA can use direct signup, then Maxed stores the resulting login and API key.',
    checklist: [
      'Open the Twenty sign-up page.',
      'Create or confirm the CPA workspace user.',
      'Generate or copy the API key for that user.',
      'Save the email, password, and API key in Maxed.',
    ],
  },
  {
    key: 'metabase',
    name: 'Metabase',
    defaultUrl: 'https://reports.maxed.life',
    loginPath: '/auth/login',
    adminPath: '/admin/people',
    setupPath: '/setup',
    recommendedPath: '/admin/people',
    embedPreferred: false,
    setupMode: 'manual',
    setupNote: 'Metabase does not expose normal public self-signup. A fresh instance must complete the initial setup flow to create the first admin account; after that, invite CPA users from Admin > People.',
    fields: ['username', 'password'],
    labels: { username: 'Email', password: 'Password', token: 'API Token', metadata: 'Metadata' },
    hint: 'Invite the CPA user in Metabase, then save the login here.',
    accountModel: 'Metabase needs one admin first; that admin invites each CPA user.',
    checklist: [
      'If this Metabase instance is fresh, complete the initial setup flow first to create the first admin account.',
      'Sign in with the Metabase admin account.',
      'Invite or confirm the CPA user from the People area.',
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
    adminPath: '/admin_console/user_management/users',
    recommendedPath: '/signup_email',
    embedPreferred: true,
    setupMode: 'signup',
    signupNote: 'Mattermost email signup is now explicitly enabled in the container config. If you prefer controlled provisioning, you can still create the CPA user from the system admin account and then save those credentials here.',
    fields: ['username', 'password'],
    labels: { username: 'Username or Email', password: 'Password', token: 'API Token', metadata: 'Metadata' },
    hint: 'Create the CPA user in Mattermost, add the user to the right team or channels, then save the login used for that workspace.',
    accountModel: 'Mattermost can use open signup or admin-created users; Maxed treats both the same after credentials are saved.',
    checklist: [
      'Open the recommended setup route to create or access the CPA user.',
      'If you are onboarding centrally, sign in as system admin and create or confirm the user manually.',
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

type ServiceCatalogEntry = {
  key: string;
  name: string;
  provisioningMode: string;
  controlPlaneManaged: boolean;
  core: boolean;
  preferredAction: string;
  setupPath?: string;
  adminPath?: string;
  note?: string;
  defaultUrl?: string | null;
  accessCapability?: {
    browserSessionBroker: boolean;
    cpaMode: string;
    adminMode: string;
  } | null;
};

type ProvisioningOverview = {
  firmId: string;
  services: Record<string, ServiceCatalogEntry & {
    configured: boolean;
    health: ServiceHealth;
    source: string;
    launch: {
      service?: string | null;
      setup?: string | null;
      admin?: string | null;
    };
    accessCapability?: {
      browserSessionBroker: boolean;
      cpaMode: string;
      adminMode: string;
    } | null;
  }>;
  summary: {
    connected: number;
    configured: number;
    coreConnected: number;
    coreTotal: number;
  };
};

type IdentityWorkspace = {
  firm: {
    id: string;
    name: string;
    email: string;
  };
  canonicalIdentity: {
    primaryMember: {
      id: string;
      name: string;
      email: string;
      role: string;
    } | null;
    canonicalEmail: string;
    canonicalUsername: string;
    bootstrapRoleLabel: string;
    cpaRoleLabel: string;
  };
  universalProcess: string[];
  services: Record<string, {
    key: string;
    name: string;
    accountType: string;
    bootstrapRequired: boolean;
    summary: string;
    recommendedWorkspace: string | null;
    suggestedIdentifier: string | null;
    credentialsSaved: boolean;
    plannedAccounts: Array<{
      id: string;
      role: string;
      identifier: string;
      status: string;
      notes: string | null;
      teamMemberId: string | null;
    }>;
  }>;
};

type AccessPolicy = {
  firmId: string;
  identityProvider: string;
  model: string;
  cpaAccess: string;
  upstreamAccess: string;
  note: string;
  services: Record<string, {
    key: string;
    name: string;
    workspacePath: string;
    cpaAccessMode: string;
    upstreamAccessMode: string;
    configured: boolean;
    bootstrapRequired: boolean;
    browserSessionBroker: boolean;
  }>;
};

type ServiceAccountRecord = {
  id: string;
  firmId: string;
  teamMemberId: string | null;
  service: string;
  role: string;
  identifier: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  teamMember?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
};

function buildServiceUrl(baseUrl: string, path = '') {
  if (!path) return baseUrl;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function buildRecommendedUrl(service: ServiceTab, baseUrl: string) {
  return buildServiceUrl(
    baseUrl,
    service.recommendedPath
      || service.registerPath
      || service.setupPath
      || service.adminPath
      || service.loginPath
      || '',
  );
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
  const [preparing, setPreparing] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [iframeVisible, setIframeVisible] = useState(true);
  const [serviceCatalog, setServiceCatalog] = useState<Record<string, ServiceCatalogEntry>>({});
  const [provisioningOverview, setProvisioningOverview] = useState<ProvisioningOverview | null>(null);
  const [identityWorkspace, setIdentityWorkspace] = useState<IdentityWorkspace | null>(null);
  const [accessPolicy, setAccessPolicy] = useState<AccessPolicy | null>(null);
  const [serviceAccounts, setServiceAccounts] = useState<ServiceAccountRecord[]>([]);
  const [accountForm, setAccountForm] = useState<Record<string, { identifier: string; status: string }>>({});
  const [savingAccountId, setSavingAccountId] = useState<string | null>(null);

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

  const fetchServiceAccounts = useCallback(async (firmId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/firms/${firmId}/service-accounts`));
      if (!res.ok) return;
      const data = (await res.json()) as ServiceAccountRecord[];
      setServiceAccounts(data);
      setAccountForm(
        Object.fromEntries(
          data.map((account) => [
            account.id,
            {
              identifier: account.identifier || '',
              status: account.status || 'planned',
            },
          ]),
        ),
      );
    } catch {}
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const [urlsRes, catalogRes] = await Promise.all([
          fetch(apiUrl('/api/services/urls')),
          fetch(apiUrl('/api/services/catalog')),
        ]);
        if (urlsRes.ok) setServiceUrls(await urlsRes.json());
        if (catalogRes.ok) {
          const items = (await catalogRes.json()) as ServiceCatalogEntry[];
          setServiceCatalog(Object.fromEntries(items.map((item) => [item.key, item])));
        }
      } catch {}

      if (firmIdParam) {
        try {
          const res = await fetch(apiUrl(`/api/firms/${firmIdParam}`));
          if (res.ok) setFirm(await res.json());
        } catch {}
        await fetchCredentials(firmIdParam);
        await fetchServiceAccounts(firmIdParam);
        try {
          const [overviewRes, identityRes, accessRes] = await Promise.all([
            fetch(apiUrl(`/api/firms/${firmIdParam}/provisioning/overview`)),
            fetch(apiUrl(`/api/firms/${firmIdParam}/identity-workspace`)),
            fetch(apiUrl(`/api/firms/${firmIdParam}/access-policy`)),
          ]);
          if (overviewRes.ok) setProvisioningOverview(await overviewRes.json());
          if (identityRes.ok) setIdentityWorkspace(await identityRes.json());
          if (accessRes.ok) setAccessPolicy(await accessRes.json());
        } catch {}
      }

      setLoading(false);
    }

    init();
  }, [fetchCredentials, fetchServiceAccounts, firmIdParam]);

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

  const handlePrepare = async () => {
    if (!firmIdParam) return;

    setPreparing(true);
    setMessage('');

    try {
      const res = await fetch(apiUrl(`/api/firms/${firmIdParam}/provisioning/prepare/${activeTab}`), {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Unable to prepare credentials.');
        return;
      }

      setCredForm((current) => ({
        ...current,
        username: data?.suggested?.username ?? current.username ?? '',
        password: data?.suggested?.password ?? current.password ?? '',
        token: data?.suggested?.token ?? current.token ?? '',
        metadata: data?.suggested?.metadata ?? current.metadata ?? '',
      }));
      setMessage('Suggested credentials prepared.');
    } catch {
      setMessage('Unable to prepare credentials.');
    } finally {
      setPreparing(false);
    }
  };

  const saveServiceAccount = async (account: ServiceAccountRecord) => {
    if (!firmIdParam) return;
    const draft = accountForm[account.id];
    if (!draft) return;

    setSavingAccountId(account.id);
    setMessage('');

    try {
      const res = await fetch(apiUrl(`/api/firms/${firmIdParam}/service-accounts/${account.service}/${account.role}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: draft.identifier,
          status: draft.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Unable to save service account.');
        return;
      }

      setMessage('Saved!');
      await fetchServiceAccounts(firmIdParam);
    } catch {
      setMessage('Unable to save service account.');
    } finally {
      setSavingAccountId(null);
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
  const overviewEntry = provisioningOverview?.services?.[activeTab];
  const catalogEntry = overviewEntry || serviceCatalog[activeTab];
  const baseUrl = serviceUrls[activeTab] || activeSvc.defaultUrl;
  const useEmbeddedFlow = activeSvc.embedPreferred !== false;
  const recommendedUrl = buildRecommendedUrl(activeSvc, baseUrl);
  const iframeUrl = recommendedUrl;
  const maxedWorkspacePath = accessPolicy?.services?.[activeTab]?.workspacePath || '/dashboard';
  const maxedWorkspaceUrl = `https://app.maxed.life${maxedWorkspacePath}`;
  const adminSetupUrl = recommendedUrl;
  const isConfigured = Boolean(
    credentials[activeTab] &&
    (credentials[activeTab].token || credentials[activeTab].username || credentials[activeTab].password),
  );
  const serviceStatus = SERVICE_TABS.reduce<Record<string, ServiceStatusEntry>>(
    (acc, service) => {
      const overview = provisioningOverview?.services?.[service.key];
      const credential = credentials[service.key];
      const configured = overview?.configured ?? Boolean(
        credential && (credential.token || credential.username || credential.password),
      );
      const health = overview?.health ?? (configured ? 'unknown' : 'disconnected');
      acc[service.key] = { configured, health };
      return acc;
    },
    {},
  );
  const activeStatus = serviceStatus[activeTab];
  const readinessSummary = Object.values(serviceStatus).reduce(
    (summary, service) => {
      if (!service || service.health === 'unknown') summary.unknown += 1;
      else if (service.health === 'connected') summary.connected += 1;
      else if (service.health === 'degraded') summary.degraded += 1;
      else summary.disconnected += 1;
      return summary;
    },
    { connected: 0, degraded: 0, disconnected: 0, unknown: 0 },
  );
  const connectedServiceCount = provisioningOverview?.summary.connected ?? Object.values(serviceStatus).filter((service) => service.health === 'connected').length;
  const configuredServiceCount = provisioningOverview?.summary.configured ?? Object.values(serviceStatus).filter((service) => service.configured).length;
  const needsSetupCount = SERVICE_TABS.length - configuredServiceCount;
  const identityEntry = identityWorkspace?.services?.[activeTab];
  const activeServiceAccounts = serviceAccounts.filter((account) => account.service === activeTab);

  const statusLabel = (health?: ServiceHealth) => {
    switch (health) {
      case 'connected':
        return 'Ready';
      case 'degraded':
        return 'Saved, verify';
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
          <p className="text-sm text-gray-500">Use one workflow for every service: open the recommended setup workspace, create or confirm the firm user, save credentials in Maxed, then verify the connection.</p>
        </div>
      </div>

      {catalogEntry ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Platform Strategy</p>
              <p className="mt-1 text-sm text-slate-800">
                {catalogEntry.controlPlaneManaged ? 'Maxed-managed provisioning' : 'Direct upstream provisioning'} · {catalogEntry.provisioningMode}
              </p>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              Unified process: open, create user, save credentials, verify
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">{activeSvc.accountModel}</p>
          {catalogEntry.note ? <p className="mt-2 text-sm text-slate-500">{catalogEntry.note}</p> : null}
        </div>
      ) : null}

      {identityWorkspace ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Firm Identity Workspace</p>
                <p className="mt-1 text-sm text-slate-600">This is the OpenFrame-style model Maxed should own: one canonical firm identity, with bootstrap admins only where upstream setup requires it.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{identityWorkspace.canonicalIdentity.bootstrapRoleLabel}</p>
                  <p className="mt-2 text-sm text-slate-700">Used only for first-run setup or user provisioning in services that need an owner/admin first.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{identityWorkspace.canonicalIdentity.cpaRoleLabel}</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{identityWorkspace.canonicalIdentity.canonicalEmail}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {identityWorkspace.canonicalIdentity.primaryMember
                      ? `${identityWorkspace.canonicalIdentity.primaryMember.name} · ${identityWorkspace.canonicalIdentity.primaryMember.role}`
                      : 'No dedicated firm team member found yet, so Maxed is using the firm email as the canonical identity.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 lg:w-[24rem]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Universal Process</p>
              <ol className="mt-3 space-y-2 text-sm text-slate-700">
                {identityWorkspace.universalProcess.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      ) : null}

      {accessPolicy ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Maxed Access Model</p>
              <p className="mt-1 text-sm text-slate-700">Identity provider: <span className="font-medium text-slate-900">{accessPolicy.identityProvider}</span></p>
              <p className="mt-1 text-sm text-slate-700">CPA access: <span className="font-medium text-slate-900">Maxed-native workspaces</span></p>
              <p className="mt-1 text-sm text-slate-700">Upstream access: <span className="font-medium text-slate-900">Platform admin setup only</span></p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 lg:w-[26rem]">
              <p className="text-sm text-slate-700">{accessPolicy.note}</p>
              <p className="mt-2 text-xs text-slate-500">
                True browser-session brokering is only shown once Maxed actually supports it. Until then, CPA handoff stays in Maxed-native workspaces.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.values(accessPolicy.services).map((service) => (
              <div key={service.key} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">{service.name}</p>
                  <span className={service.configured ? 'badge-green' : 'badge-yellow'}>
                    {service.configured ? 'Mapped' : 'Pending'}
                  </span>
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">CPA workspace</p>
                <p className="mt-1 text-sm text-slate-700">{service.workspacePath}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {service.bootstrapRequired ? 'Bootstrap admin required before CPA handoff.' : 'Direct Maxed-first access model.'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {service.browserSessionBroker ? 'Brokered browser session available.' : 'No brokered browser session yet; Maxed remains the CPA-facing surface.'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Services ready</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{connectedServiceCount}/{SERVICE_TABS.length}</p>
          <p className="mt-1 text-sm text-slate-500">Verified and responding in this firm workspace</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Credentials saved</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{configuredServiceCount}</p>
          <p className="mt-1 text-sm text-slate-500">Service accounts already stored in Maxed</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Needs setup</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{needsSetupCount}</p>
          <p className="mt-1 text-sm text-slate-500">Services without saved credentials yet</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Needs verification</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{readinessSummary.degraded}</p>
          <p className="mt-1 text-sm text-slate-500">Credentials exist, but the health check is not fully green yet</p>
        </div>
      </div>

      {provisioningOverview ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Service Setup Board</p>
              <p className="mt-1 text-sm text-slate-500">Every service follows the same four-step setup process.</p>
            </div>
            <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              {connectedServiceCount}/{SERVICE_TABS.length} services ready
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.values(provisioningOverview.services)
              .map((service) => (
                <button
                  key={service.key}
                  onClick={() => {
                    setActiveTab(service.key);
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{service.name}</p>
                      <p className="mt-1 text-xs text-slate-500">Open, create user, save credentials, verify</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(service.health)}`}>
                      {statusLabel(service.health)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className={service.configured ? 'badge-green' : 'badge-yellow'}>
                      {service.configured ? 'Credentials saved' : 'Credentials missing'}
                    </span>
                    <span className="badge-blue">
                      {service.accessCapability?.browserSessionBroker ? 'Brokered session' : 'Maxed-native CPA access'}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      ) : null}

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
                    Admin setup surface: <code className="rounded bg-gray-100 px-1">{adminSetupUrl}</code>
                  </span>
                  <button
                    onClick={() => setIframeVisible((current) => !current)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700"
                  >
                    {iframeVisible ? 'Hide embed' : 'Show embed'}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {!useEmbeddedFlow
                    ? 'This service should be bootstrapped in a dedicated admin tab. CPA handoff remains in Maxed.'
                    : 'Use this embedded admin surface only for setup. CPA handoff remains in Maxed-native workspaces.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <a href={maxedWorkspaceUrl} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">
                  Open Maxed workspace
                </a>
                <a href={adminSetupUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                  Open admin setup
                </a>
              </div>
            </div>
          </div>

          {iframeVisible && useEmbeddedFlow ? (
            <iframe
              key={activeTab}
              src={iframeUrl}
              className="w-full rounded-xl border border-gray-200 bg-white"
              style={{ minHeight: '70vh' }}
              title={activeSvc.name}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
              {!useEmbeddedFlow
                ? 'This service should be bootstrapped in a dedicated admin tab. Open the admin setup surface above, complete setup there, then keep CPA handoff inside Maxed.'
                : 'Embedded admin view hidden. Open the admin setup surface above and follow the same four-step process shown on the right.'}
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

          {identityEntry ? (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Identity Model</p>
              <p className="mt-2 text-sm text-slate-700">{identityEntry.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={identityEntry.bootstrapRequired ? 'badge-yellow' : 'badge-green'}>
                  {identityEntry.bootstrapRequired ? 'Bootstrap admin required' : 'Direct firm user supported'}
                </span>
                <span className="badge-blue">
                  Canonical user: {identityEntry.suggestedIdentifier || identityWorkspace?.canonicalIdentity.canonicalEmail || 'n/a'}
                </span>
              </div>
              {activeServiceAccounts.length ? (
                <div className="mt-4 space-y-2">
                  {activeServiceAccounts.map((account) => (
                    <div key={account.id} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900">
                          {account.role === 'bootstrap_admin' ? 'Bootstrap admin' : 'Canonical CPA user'}
                        </p>
                        <span className="badge-blue">{accountForm[account.id]?.status || account.status}</span>
                      </div>
                      <div className="mt-3 grid gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Identifier</label>
                          <input
                            className="input text-sm"
                            value={accountForm[account.id]?.identifier || ''}
                            onChange={(event) =>
                              setAccountForm((current) => ({
                                ...current,
                                [account.id]: {
                                  ...(current[account.id] || { identifier: '', status: account.status }),
                                  identifier: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                          <select
                            className="input text-sm"
                            value={accountForm[account.id]?.status || account.status}
                            onChange={(event) =>
                              setAccountForm((current) => ({
                                ...current,
                                [account.id]: {
                                  ...(current[account.id] || { identifier: account.identifier, status: account.status }),
                                  status: event.target.value,
                                },
                              }))
                            }
                          >
                            <option value="planned">Planned</option>
                            <option value="bootstrap_pending">Bootstrap pending</option>
                            <option value="provisioned">Provisioned</option>
                            <option value="verified">Verified</option>
                          </select>
                        </div>
                        <button
                          onClick={() => saveServiceAccount(account)}
                          disabled={savingAccountId === account.id}
                          className="btn-secondary text-sm disabled:opacity-50"
                        >
                          {savingAccountId === account.id ? 'Saving...' : 'Save service account'}
                        </button>
                      </div>
                      {account.teamMember ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Linked team member: {account.teamMember.name} · {account.teamMember.email}
                        </p>
                      ) : null}
                      {account.notes ? <p className="mt-2 text-xs text-slate-500">{account.notes}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {(activeSvc.signupNote || activeSvc.setupNote) ? (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              {activeSvc.signupNote || activeSvc.setupNote}
            </div>
          ) : null}

          {!useEmbeddedFlow ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This service does not have a Maxed-brokered browser session yet. Use the admin setup surface to provision it, then keep CPA work inside Maxed.
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

          <button
            onClick={handlePrepare}
            disabled={preparing}
            className="btn-secondary mt-2 w-full text-sm disabled:opacity-50"
          >
            {preparing ? 'Preparing...' : 'Generate Suggested Credentials'}
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
