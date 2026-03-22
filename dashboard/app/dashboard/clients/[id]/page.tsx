'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { firmFetch, serviceFetch } from '@/lib/service-client';
import { formatCurrency, formatDate, normalizeFirmClients } from '@/lib/service-adapters';

type Tab = 'overview' | 'documents' | 'invoices' | 'advisory';

type Scenario = {
  id: string;
  question: string;
  optionChosen: string | null;
  projectedImpact: number | null;
  actualImpact: number | null;
  resolvedAt: string | null;
};

type DashboardSummary = {
  outstandingInvoices?: number;
  pendingDocuments?: number;
  recentMessages?: number;
};

type ClientFormState = {
  name: string;
  email: string;
  phone: string;
  businessType: string;
  annualRevenue: string;
  employeeCount: string;
};

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [client, setClient] = useState<ReturnType<typeof normalizeFirmClients>[number] | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState<ClientFormState>({
    name: '',
    email: '',
    phone: '',
    businessType: '',
    annualRevenue: '',
    employeeCount: '',
  });

  const syncFormFromClient = useCallback((nextClient: ReturnType<typeof normalizeFirmClients>[number] | null) => {
    if (!nextClient) return;
    setForm({
      name: nextClient.name,
      email: nextClient.email,
      phone: nextClient.phone,
      businessType: nextClient.businessType,
      annualRevenue: String(nextClient.annualRevenue || ''),
      employeeCount: String(nextClient.employeeCount || ''),
    });
  }, []);

  const fetchClient = useCallback(async () => {
    setLoading(true);
    setError('');

    const results = await Promise.allSettled([
      firmFetch('/clients'),
      serviceFetch(`/api/clients/${clientId}/scenarios`),
      serviceFetch(`/api/clients/${clientId}/dashboard`),
    ]);

    const [clientsResult, scenariosResult, summaryResult] = results;

    if (clientsResult.status === 'fulfilled') {
      const clients = normalizeFirmClients(clientsResult.value);
      const selected = clients.find((entry) => entry.id === clientId) || null;
      setClient(selected);
      syncFormFromClient(selected);
    } else {
      setError(clientsResult.reason instanceof Error ? clientsResult.reason.message : 'Unable to load client.');
    }

    if (scenariosResult.status === 'fulfilled') {
      setScenarios(Array.isArray(scenariosResult.value) ? (scenariosResult.value as Scenario[]) : []);
    } else {
      setScenarios([]);
    }

    if (summaryResult.status === 'fulfilled') {
      setSummary((summaryResult.value as DashboardSummary) || {});
    } else {
      setSummary({});
    }

    setLoading(false);
  }, [clientId, syncFormFromClient]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'documents', label: 'Documents' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'advisory', label: 'Advisory' },
  ];

  const openInvoices = useMemo(
    () => client?.invoices.filter((invoice) => invoice.status !== 'paid') || [],
    [client],
  );

  const estimatedImpact = useMemo(
    () => scenarios.reduce((sum, scenario) => sum + (scenario.projectedImpact || 0), 0),
    [scenarios],
  );

  const handleSaveClient = useCallback(async () => {
    setSaving(true);
    setSaveError('');

    try {
      await firmFetch(`/clients/${clientId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          businessType: form.businessType || 'Unclassified',
          annualRevenue: Number(form.annualRevenue) || 0,
          employeeCount: Number(form.employeeCount) || 0,
        }),
      });

      await fetchClient();
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save client.');
    } finally {
      setSaving(false);
    }
  }, [clientId, fetchClient, form]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="card space-y-4 p-6">
          <div className="skeleton h-6 w-64" />
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-4 w-56" />
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="mx-auto max-w-7xl py-12 text-center">
        <p className="text-gray-500">{error || 'Client not found'}</p>
        <Link href="/dashboard/clients" className="mt-2 inline-block text-sm text-brand-600 hover:text-brand-700">
          Back to clients
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard/clients" className="hover:text-gray-700">Clients</Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{client.name}</span>
      </div>

      <div className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              <span className="badge-green">active</span>
            </div>
            <p className="mt-1 text-gray-500">{client.businessType || 'Unclassified'} · {client.email}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing((current) => !current)} className="btn-secondary text-sm">
              {editing ? 'Close Editor' : 'Edit Client'}
            </button>
            <Link href="/dashboard/documents" className="btn-secondary text-sm">Documents</Link>
            <Link href="/dashboard/advisory" className="btn-primary text-sm">Run Scenario</Link>
          </div>
        </div>
      </div>

      {editing ? (
        <div className="card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Client profile editor</h2>
              <p className="mt-1 text-sm text-gray-500">Update core client information without leaving the record.</p>
            </div>
            <button
              onClick={handleSaveClient}
              disabled={saving}
              className="btn-primary text-sm disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              Business name
              <input className="input mt-2" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Email
              <input className="input mt-2" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Phone
              <input className="input mt-2" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Business type
              <input className="input mt-2" value={form.businessType} onChange={(event) => setForm((current) => ({ ...current, businessType: event.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Annual revenue
              <input className="input mt-2" type="number" value={form.annualRevenue} onChange={(event) => setForm((current) => ({ ...current, annualRevenue: event.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Employees
              <input className="input mt-2" type="number" value={form.employeeCount} onChange={(event) => setForm((current) => ({ ...current, employeeCount: event.target.value }))} />
            </label>
          </div>
          {saveError ? <p className="mt-3 text-sm text-red-600">{saveError}</p> : null}
        </div>
      ) : null}

      <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={activeTab === tab.key ? 'tab-active' : 'tab-inactive'}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="card space-y-4 p-6">
            <h3 className="text-sm font-semibold text-gray-900">Client Information</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Business Type</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{client.businessType || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Annual Revenue</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{formatCurrency(client.annualRevenue || 0)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Employees</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{client.employeeCount || 0}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Phone</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{client.phone || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Created</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{formatDate(client.createdAt)}</dd>
              </div>
            </dl>
          </div>

          <div className="card space-y-4 p-6">
            <h3 className="text-sm font-semibold text-gray-900">Key Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Open Invoices</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{summary.outstandingInvoices || openInvoices.length}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Documents</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{client.documents.length}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Scenarios Run</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{scenarios.length}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Est. Impact</p>
                <p className="mt-1 text-xl font-bold text-green-600">{formatCurrency(estimatedImpact)}</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">Recent messages</p>
              <p className="mt-1 text-sm text-slate-500">{summary.recentMessages || client.messages.length} messages in the current client history.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/dashboard/invoicing" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:bg-brand-50/40">
                Open billing workspace
              </Link>
              <Link href="/dashboard/documents" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:bg-brand-50/40">
                Review documents
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'documents' ? (
        <div className="card">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
            <Link href="/dashboard/documents" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Open in Documents
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {client.documents.length === 0 ? (
              <div className="px-6 py-8 text-sm text-gray-500">No documents available for this client yet.</div>
            ) : (
              client.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-red-50">
                      <span className="text-xs font-medium text-red-600">{doc.type.slice(0, 3).toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-900">{doc.title}</span>
                      <p className="text-xs text-gray-400">{doc.status}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(doc.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'invoices' ? (
        <div className="card">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Invoices</h3>
            <Link href="/dashboard/invoicing" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Open Billing
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Invoice</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {client.invoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-sm text-gray-500">No invoices for this client yet.</td>
                  </tr>
                ) : (
                  client.invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{invoice.invoiceNinjaId || invoice.id.slice(0, 8)}</td>
                      <td className="table-cell">{formatCurrency(invoice.amount)}</td>
                      <td className="table-cell">
                        <span className={invoice.status === 'paid' ? 'badge-green' : 'badge-yellow'}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="table-cell text-gray-500">{formatDate(invoice.dueDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'advisory' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Advisory Scenarios</h3>
            <Link href="/dashboard/advisory" className="btn-primary text-sm">
              Run New Scenario
            </Link>
          </div>
          {scenarios.length === 0 ? (
            <div className="card p-8 text-sm text-gray-500">No advisory scenarios recorded for this client yet.</div>
          ) : (
            scenarios.map((scenario) => (
              <div key={scenario.id} className="card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">{scenario.question}</h4>
                    <p className="mt-1 text-sm text-gray-500">
                      {scenario.optionChosen ? `Chosen option: ${scenario.optionChosen}` : 'Option still under review'}
                    </p>
                  </div>
                  <span className={scenario.resolvedAt ? 'badge-green' : 'badge-blue'}>
                    {scenario.resolvedAt ? 'resolved' : 'open'}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Projected Impact</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{formatCurrency(scenario.projectedImpact || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Actual Impact</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{formatCurrency(scenario.actualImpact || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{scenario.resolvedAt ? 'Resolved' : 'Open'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Resolved</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{scenario.resolvedAt ? formatDate(scenario.resolvedAt) : 'Pending'}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
