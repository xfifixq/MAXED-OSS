'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiUrl, serviceHeaders } from '@/lib/api';

interface Invoice {
  id: string;
  number: string;
  client_id: string;
  amount: number;
  balance: number;
  status_id: number;
  date: string;
  due_date: string;
}

interface InvoiceClient {
  id: string;
  name: string;
  display_name: string;
  balance: number;
}

const STATUS_MAP: Record<number, { label: string; badge: string }> = {
  1: { label: 'Draft', badge: 'badge-gray' },
  2: { label: 'Sent', badge: 'badge-blue' },
  3: { label: 'Partial', badge: 'badge-yellow' },
  4: { label: 'Paid', badge: 'badge-green' },
  5: { label: 'Cancelled', badge: 'badge-red' },
  6: { label: 'Overdue', badge: 'badge-red' },
};

const PLACEHOLDER_CLIENTS: InvoiceClient[] = [
  { id: 'c1', name: 'Acme Corporation', display_name: 'Acme Corporation', balance: 4500 },
  { id: 'c2', name: 'TechStart Inc', display_name: 'TechStart Inc', balance: 1200 },
  { id: 'c3', name: 'Baker & Associates LLC', display_name: 'Baker & Associates LLC', balance: 0 },
  { id: 'c4', name: 'Summit Partners', display_name: 'Summit Partners', balance: 3200 },
  { id: 'c5', name: 'GreenLeaf Organic', display_name: 'GreenLeaf Organic', balance: 750 },
];

const PLACEHOLDER_INVOICES: Invoice[] = [
  { id: '1', number: 'INV-0001', client_id: 'c1', amount: 4500, balance: 4500, status_id: 2, date: '2026-03-01', due_date: '2026-03-31' },
  { id: '2', number: 'INV-0002', client_id: 'c2', amount: 1200, balance: 0, status_id: 4, date: '2026-02-15', due_date: '2026-03-15' },
  { id: '3', number: 'INV-0003', client_id: 'c3', amount: 3800, balance: 0, status_id: 4, date: '2026-03-05', due_date: '2026-04-05' },
  { id: '4', number: 'INV-0004', client_id: 'c4', amount: 6200, balance: 3200, status_id: 3, date: '2026-02-20', due_date: '2026-03-20' },
  { id: '5', number: 'INV-0005', client_id: 'c5', amount: 750, balance: 750, status_id: 6, date: '2026-01-10', due_date: '2026-02-10' },
  { id: '6', number: 'INV-0006', client_id: 'c1', amount: 2100, balance: 2100, status_id: 1, date: '2026-03-12', due_date: '2026-04-12' },
  { id: '7', number: 'INV-0007', client_id: 'c3', amount: 5500, balance: 0, status_id: 5, date: '2026-01-20', due_date: '2026-02-20' },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);

const formatDate = (dateStr: string) => {
  if (!dateStr) return '--';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function InvoicingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<InvoiceClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [invRes, clientRes] = await Promise.all([
          fetch(apiUrl('/api/services/invoiceninja/invoices?page=1'), { headers: serviceHeaders() }),
          fetch(apiUrl('/api/services/invoiceninja/clients'), { headers: serviceHeaders() }),
        ]);

        if (!invRes.ok || !clientRes.ok) throw new Error('API error');

        const invData = await invRes.json();
        const clientData = await clientRes.json();

        setInvoices(Array.isArray(invData.data) ? invData.data : []);
        setClients(Array.isArray(clientData.data) ? clientData.data : []);
      } catch {
        setInvoices(PLACEHOLDER_INVOICES);
        setClients(PLACEHOLDER_CLIENTS);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => {
      map[c.id] = c.display_name || c.name;
    });
    return map;
  }, [clients]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const clientName = (clientMap[inv.client_id] || '').toLowerCase();
      const matchesSearch =
        !search ||
        inv.number.toLowerCase().includes(search.toLowerCase()) ||
        clientName.includes(search.toLowerCase());
      const matchesStatus = statusFilter === null || inv.status_id === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter, clientMap]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalOutstanding = 0;
    let paidThisMonth = 0;
    let overdueCount = 0;

    invoices.forEach((inv) => {
      if (inv.balance > 0 && inv.status_id !== 5) {
        totalOutstanding += inv.balance;
      }
      if (inv.status_id === 4) {
        const d = new Date(inv.date + 'T00:00:00');
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          paidThisMonth += inv.amount;
        }
      }
      if (inv.status_id === 6) {
        overdueCount++;
      }
    });

    return {
      totalOutstanding,
      paidThisMonth,
      overdueCount,
      totalInvoices: invoices.length,
    };
  }, [invoices]);

  const statusBadge = (statusId: number) => {
    const status = STATUS_MAP[statusId] || { label: 'Unknown', badge: 'badge' };
    return <span className={status.badge}>{status.label}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoicing</h1>
          <p className="text-gray-500 text-sm mt-1">Manage invoices and billing</p>
        </div>
        <button className="btn-primary">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Invoice
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Outstanding</p>
              {loading ? (
                <div className="skeleton h-7 w-28 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.totalOutstanding)}</p>
              )}
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Paid This Month</p>
              {loading ? (
                <div className="skeleton h-7 w-28 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.paidThisMonth)}</p>
              )}
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Overdue</p>
              {loading ? (
                <div className="skeleton h-7 w-12 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.overdueCount}</p>
              )}
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Invoices</p>
              {loading ? (
                <div className="skeleton h-7 w-12 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalInvoices}</p>
              )}
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by invoice number or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <select
            value={statusFilter ?? ''}
            onChange={(e) => setStatusFilter(e.target.value ? Number(e.target.value) : null)}
            className="input w-full sm:w-44"
          >
            <option value="">All Statuses</option>
            <option value="1">Draft</option>
            <option value="2">Sent</option>
            <option value="3">Partial</option>
            <option value="4">Paid</option>
            <option value="5">Cancelled</option>
            <option value="6">Overdue</option>
          </select>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Number</th>
                <th className="table-header">Client</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Balance Due</th>
                <th className="table-header">Status</th>
                <th className="table-header">Date</th>
                <th className="table-header">Due Date</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="table-cell"><div className="skeleton h-4 w-24" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-36" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-20" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-20" /></td>
                    <td className="table-cell"><div className="skeleton h-5 w-16 rounded-full" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-24" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-24" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-16" /></td>
                  </tr>
                ))
              ) : filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium text-gray-900">{inv.number}</td>
                    <td className="table-cell text-gray-700">{clientMap[inv.client_id] || 'Unknown Client'}</td>
                    <td className="table-cell text-gray-900">{formatCurrency(inv.amount)}</td>
                    <td className="table-cell">
                      <span className={inv.balance > 0 ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                        {formatCurrency(inv.balance)}
                      </span>
                    </td>
                    <td className="table-cell">{statusBadge(inv.status_id)}</td>
                    <td className="table-cell text-gray-500">{formatDate(inv.date)}</td>
                    <td className="table-cell text-gray-500">{formatDate(inv.due_date)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <button
                          className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                          title="View invoice"
                        >
                          View
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                          title="Send invoice"
                        >
                          Send
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                    No invoices found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
