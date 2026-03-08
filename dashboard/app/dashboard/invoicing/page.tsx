'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { firmApiUrl } from '@/lib/api';

const INVOICE_NINJA_URL = process.env.NEXT_PUBLIC_INVOICE_NINJA_URL || 'http://localhost:8080';

interface Invoice {
  id: string;
  number: string;
  clientName: string;
  amount: number;
  status: string;
  date: string;
  dueDate: string;
}

export default function InvoicingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await fetch(firmApiUrl('/invoices'));
        if (res.ok) {
          const data = await res.json();
          setInvoices(Array.isArray(data) ? data : data.invoices || []);
        }
      } catch {
        setInvoices([
          { id: '1', number: 'INV-1042', clientName: 'Acme Corporation', amount: 3500, status: 'paid', date: '2025-01-10', dueDate: '2025-02-10' },
          { id: '2', number: 'INV-1041', clientName: 'TechStart Inc', amount: 5200, status: 'pending', date: '2025-01-08', dueDate: '2025-02-08' },
          { id: '3', number: 'INV-1040', clientName: 'Baker & Associates LLC', amount: 2800, status: 'overdue', date: '2024-12-15', dueDate: '2025-01-15' },
          { id: '4', number: 'INV-1039', clientName: 'Summit Partners', amount: 7500, status: 'pending', date: '2025-01-05', dueDate: '2025-02-05' },
          { id: '5', number: 'INV-1038', clientName: 'GreenLeaf Organic', amount: 1200, status: 'paid', date: '2024-12-20', dueDate: '2025-01-20' },
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const totalPending = invoices.filter((i) => i.status === 'pending').reduce((sum, i) => sum + i.amount, 0);
  const totalOverdue = invoices.filter((i) => i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <span className="badge-green">Paid</span>;
      case 'pending': return <span className="badge-yellow">Pending</span>;
      case 'overdue': return <span className="badge-red">Overdue</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Back to Dashboard"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoicing</h1>
            <p className="text-gray-500 text-sm mt-1">Track and manage client invoices</p>
          </div>
        </div>
        <a
          href={INVOICE_NINJA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Invoice
        </a>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-sm font-medium text-gray-500">Pending</p>
          {loading ? (
            <div className="skeleton h-7 w-24 mt-1" />
          ) : (
            <p className="text-xl font-bold text-yellow-600 mt-1">{formatCurrency(totalPending)}</p>
          )}
        </div>
        <div className="stat-card">
          <p className="text-sm font-medium text-gray-500">Overdue</p>
          {loading ? (
            <div className="skeleton h-7 w-24 mt-1" />
          ) : (
            <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalOverdue)}</p>
          )}
        </div>
        <div className="stat-card">
          <p className="text-sm font-medium text-gray-500">Paid (Recent)</p>
          {loading ? (
            <div className="skeleton h-7 w-24 mt-1" />
          ) : (
            <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(totalPaid)}</p>
          )}
        </div>
      </div>

      {/* Invoice Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Invoice #</th>
                <th className="table-header">Client</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Status</th>
                <th className="table-header">Date</th>
                <th className="table-header">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="table-cell"><div className="skeleton h-4 w-20" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-32" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-20" /></td>
                    <td className="table-cell"><div className="skeleton h-5 w-16 rounded-full" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-24" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-24" /></td>
                  </tr>
                ))
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium text-brand-600">{invoice.number}</td>
                    <td className="table-cell">{invoice.clientName}</td>
                    <td className="table-cell font-medium">{formatCurrency(invoice.amount)}</td>
                    <td className="table-cell">{statusBadge(invoice.status)}</td>
                    <td className="table-cell text-gray-500">{invoice.date}</td>
                    <td className="table-cell text-gray-500">{invoice.dueDate}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
