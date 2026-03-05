'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { firmApiUrl } from '@/lib/api';

interface Client {
  id: string;
  name: string;
  businessType: string;
  annualRevenue: number;
  status: string;
  email: string;
}

function AddClientModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    businessType: 'LLC',
    annualRevenue: '',
  });
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(firmApiUrl('/clients'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          annualRevenue: parseFloat(form.annualRevenue) || 0,
        }),
      });
      onClose();
    } catch {
      // Handle error silently for now
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Add New Client</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Enter business name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="contact@business.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
            <select
              className="input"
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
            >
              <option value="LLC">LLC</option>
              <option value="S-Corp">S-Corp</option>
              <option value="C-Corp">C-Corp</option>
              <option value="Sole Proprietor">Sole Proprietor</option>
              <option value="Partnership">Partnership</option>
              <option value="Non-Profit">Non-Profit</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Annual Revenue</label>
            <input
              className="input"
              type="number"
              value={form.annualRevenue}
              onChange={(e) => setForm({ ...form, annualRevenue: e.target.value })}
              placeholder="0"
            />
          </div>

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
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch(firmApiUrl('/clients'));
        if (res.ok) {
          const data = await res.json();
          setClients(Array.isArray(data) ? data : data.clients || []);
        }
      } catch {
        // Placeholder data
        setClients([
          { id: '1', name: 'Acme Corporation', businessType: 'C-Corp', annualRevenue: 2500000, status: 'active', email: 'cfo@acme.com' },
          { id: '2', name: 'TechStart Inc', businessType: 'S-Corp', annualRevenue: 850000, status: 'active', email: 'admin@techstart.io' },
          { id: '3', name: 'Baker & Associates LLC', businessType: 'LLC', annualRevenue: 1200000, status: 'active', email: 'jbaker@bakerllc.com' },
          { id: '4', name: 'Summit Partners', businessType: 'Partnership', annualRevenue: 3100000, status: 'onboarding', email: 'info@summitpartners.com' },
          { id: '5', name: 'GreenLeaf Organic', businessType: 'LLC', annualRevenue: 450000, status: 'active', email: 'owner@greenleaf.co' },
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.businessType.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge-green">Active</span>;
      case 'onboarding':
        return <span className="badge-blue">Onboarding</span>;
      case 'inactive':
        return <span className="badge-yellow">Inactive</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your firm&apos;s client portfolio</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Client
        </button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search clients by name or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Business Type</th>
                <th className="table-header">Annual Revenue</th>
                <th className="table-header">Status</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="table-cell"><div className="skeleton h-4 w-40" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-20" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-24" /></td>
                    <td className="table-cell"><div className="skeleton h-5 w-16 rounded-full" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-12" /></td>
                  </tr>
                ))
              ) : filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        className="font-medium text-brand-600 hover:text-brand-700"
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td className="table-cell text-gray-500">{client.businessType}</td>
                    <td className="table-cell">{formatCurrency(client.annualRevenue)}</td>
                    <td className="table-cell">{statusBadge(client.status)}</td>
                    <td className="table-cell">
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No clients found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddClientModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
