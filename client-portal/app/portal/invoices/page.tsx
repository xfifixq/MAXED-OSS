'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const INVOICE_NINJA_URL = process.env.NEXT_PUBLIC_INVOICE_NINJA_URL || 'http://localhost:8080';

interface Invoice {
  id: string;
  number: string;
  amount: number;
  status: string;
  dueDate: string;
  issuedDate?: string;
  description?: string;
  paymentUrl?: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoices() {
      const clientId = localStorage.getItem('clientId');
      if (!clientId) return;

      try {
        const res = await fetch(`${API_URL}/api/clients/${clientId}/invoices`);
        if (res.ok) {
          const data = await res.json();
          setInvoices(Array.isArray(data) ? data : data.invoices || []);
        }
      } catch {
        // API unavailable
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, []);

  function getStatusBadge(status: string) {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      paid: { bg: 'bg-green-50', text: 'text-green-700', label: 'Paid' },
      sent: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Sent' },
      outstanding: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Outstanding' },
      overdue: { bg: 'bg-red-50', text: 'text-red-700', label: 'Overdue' },
      draft: { bg: 'bg-gray-50', text: 'text-gray-600', label: 'Draft' },
      partial: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Partial' },
    };
    const s = statusMap[status] || statusMap.outstanding;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  function getPaymentUrl(invoice: Invoice) {
    return invoice.paymentUrl || `${INVOICE_NINJA_URL}/client/invoices/${invoice.id}`;
  }

  const unpaidInvoices = invoices.filter(
    (inv) => inv.status !== 'paid' && inv.status !== 'draft'
  );
  const paidInvoices = invoices.filter((inv) => inv.status === 'paid');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="page-title">Invoices</h1>
        <p className="mt-1 text-gray-500">View and pay your invoices.</p>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-gray-400">Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="mx-auto w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500 text-lg mb-2">No invoices yet</p>
          <p className="text-gray-400 text-sm">Your invoices will appear here.</p>
        </div>
      ) : (
        <>
          {/* Outstanding Invoices */}
          {unpaidInvoices.length > 0 && (
            <div>
              <h2 className="section-label mb-4">Outstanding</h2>
              <div className="space-y-4">
                {unpaidInvoices.map((invoice) => (
                  <div key={invoice.id} className="card flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-semibold text-gray-900">Invoice #{invoice.number}</p>
                        {getStatusBadge(invoice.status)}
                      </div>
                      {invoice.description && (
                        <p className="text-sm text-gray-500 truncate">{invoice.description}</p>
                      )}
                      <p className="text-sm text-gray-400 mt-1">
                        Due: {new Date(invoice.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 sm:flex-shrink-0">
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(invoice.amount)}
                      </p>
                      <a
                        href={getPaymentUrl(invoice)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary whitespace-nowrap"
                      >
                        Pay Now
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Paid Invoices */}
          {paidInvoices.length > 0 && (
            <div>
              <h2 className="section-label mb-4">Paid</h2>
              <div className="card overflow-hidden p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Invoice</th>
                      <th className="text-left text-sm font-medium text-gray-500 px-6 py-4 hidden sm:table-cell">Date</th>
                      <th className="text-right text-sm font-medium text-gray-500 px-6 py-4">Amount</th>
                      <th className="text-right text-sm font-medium text-gray-500 px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paidInvoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          #{invoice.number}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 hidden sm:table-cell">
                          {new Date(invoice.dueDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-900">
                          {formatCurrency(invoice.amount)}
                        </td>
                        <td className="px-6 py-4 text-right">{getStatusBadge(invoice.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
