'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { firmFetch } from '@/lib/service-client';
import { formatCurrency, normalizeFirmClients } from '@/lib/service-adapters';

function AddClientModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    businessType: 'LLC',
    annualRevenue: '',
    employeeCount: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await firmFetch('/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          businessType: form.businessType,
          annualRevenue: parseFloat(form.annualRevenue) || 0,
          employeeCount: parseInt(form.employeeCount, 10) || 0,
        }),
      });
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add client.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add New Client</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Business Name</label>
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Enter business name" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="contact@business.com" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="(555) 123-4567" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Business Type</label>
            <select className="input" value={form.businessType} onChange={(event) => setForm({ ...form, businessType: event.target.value })}>
              <option value="LLC">LLC</option>
              <option value="S-Corp">S-Corp</option>
              <option value="C-Corp">C-Corp</option>
              <option value="Sole Proprietor">Sole Proprietor</option>
              <option value="Partnership">Partnership</option>
              <option value="Non-Profit">Non-Profit</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Annual Revenue</label>
              <input className="input" type="number" value={form.annualRevenue} onChange={(event) => setForm({ ...form, annualRevenue: event.target.value })} placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Employees</label>
              <input className="input" type="number" value={form.employeeCount} onChange={(event) => setForm({ ...form, employeeCount: event.target.value })} placeholder="0" />
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">
              {submitting ? 'Adding...' : 'Add Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ReturnType<typeof normalizeFirmClients>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [readinessFilter, setReadinessFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState('');

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const payload = await firmFetch('/clients');
      setClients(normalizeFirmClients(payload));
    } catch (err) {
      setClients([]);
      setError(err instanceof Error ? err.message : 'Unable to load clients.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesSearch = !query || [client.name, client.businessType, client.email].join(' ').toLowerCase().includes(query);
      if (!matchesSearch) return false;

      switch (readinessFilter) {
        case 'ready':
          return Boolean(client.bigcapitalId && client.invoiceNinjaId && client.paperlessTag);
        case 'missing-ledger':
          return !client.bigcapitalId;
        case 'missing-billing':
          return !client.invoiceNinjaId;
        case 'missing-docs':
          return !client.paperlessTag;
        default:
          return true;
      }
    });
  }, [clients, readinessFilter, search]);

  const clientStage = (client: ReturnType<typeof normalizeFirmClients>[number]) => {
    if (client.invoices.some((invoice) => invoice.status !== 'paid')) return 'follow-up';
    if (client.documents.length === 0 && client.messages.length === 0) return 'onboarding';
    return 'active';
  };

  const statusBadge = (client: ReturnType<typeof normalizeFirmClients>[number]) => {
    const stage = clientStage(client);
    switch (stage) {
      case 'active':
        return <span className="badge-green">Active</span>;
      case 'onboarding':
        return <span className="badge-blue">Onboarding</span>;
      case 'follow-up':
        return <span className="badge-yellow">Billing Follow-up</span>;
      default:
        return <span className="badge">Client</span>;
    }
  };

  const readinessBadges = (client: ReturnType<typeof normalizeFirmClients>[number]) => (
    <div className="flex flex-wrap gap-1.5 text-xs">
      <span className={client.bigcapitalId ? 'badge-green' : 'badge-yellow'}>
        {client.bigcapitalId ? 'Ledger' : 'No ledger'}
      </span>
      <span className={client.invoiceNinjaId ? 'badge-green' : 'badge-yellow'}>
        {client.invoiceNinjaId ? 'Billing' : 'No billing'}
      </span>
      <span className={client.paperlessTag ? 'badge-green' : 'badge-yellow'}>
        {client.paperlessTag ? 'Docs' : 'No docs'}
      </span>
    </div>
  );

  const readyCount = useMemo(
    () => clients.filter((client) => client.bigcapitalId && client.invoiceNinjaId && client.paperlessTag).length,
    [clients],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your firm&apos;s client portfolio</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Client
        </button>
      </div>

      <div className="card p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr,220px,auto]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search clients by name, email, or type..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input pl-9"
            />
          </div>
          <select className="input" value={readinessFilter} onChange={(event) => setReadinessFilter(event.target.value)}>
            <option value="all">All clients</option>
            <option value="ready">CPA ready</option>
            <option value="missing-ledger">Missing ledger</option>
            <option value="missing-billing">Missing billing</option>
            <option value="missing-docs">Missing docs</option>
          </select>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {readyCount} of {clients.length} clients fully linked
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Business Type</th>
                <th className="table-header">Annual Revenue</th>
                <th className="table-header">Pipeline Status</th>
                <th className="table-header">Readiness</th>
                <th className="table-header">Activity</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                <tr key={index}>
                  <td className="table-cell"><div className="skeleton h-4 w-40" /></td>
                  <td className="table-cell"><div className="skeleton h-4 w-20" /></td>
                  <td className="table-cell"><div className="skeleton h-4 w-24" /></td>
                  <td className="table-cell"><div className="skeleton h-5 w-24 rounded-full" /></td>
                  <td className="table-cell"><div className="skeleton h-5 w-36 rounded-full" /></td>
                  <td className="table-cell"><div className="skeleton h-4 w-20" /></td>
                  <td className="table-cell"><div className="skeleton h-4 w-12" /></td>
                </tr>
                ))
              ) : filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div>
                        <Link href={`/dashboard/clients/${client.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                          {client.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-gray-400">{client.email}</p>
                      </div>
                    </td>
                    <td className="table-cell text-gray-500">{client.businessType || 'Unclassified'}</td>
                    <td className="table-cell">{formatCurrency(client.annualRevenue || 0)}</td>
                    <td className="table-cell">{statusBadge(client)}</td>
                    <td className="table-cell">{readinessBadges(client)}</td>
                    <td className="table-cell text-sm text-gray-500">
                      {client.documents.length} docs · {client.invoices.length} invoices · {client.messages.length} msgs
                    </td>
                    <td className="table-cell">
                      <Link href={`/dashboard/clients/${client.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                    No clients found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddClientModal open={showAddModal} onClose={() => setShowAddModal(false)} onCreated={loadClients} />
    </div>
  );
}
