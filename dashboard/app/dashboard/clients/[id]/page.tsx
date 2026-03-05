'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { firmApiUrl } from '@/lib/api';

type Tab = 'overview' | 'documents' | 'invoices' | 'advisory';

interface Client {
  id: string;
  name: string;
  businessType: string;
  annualRevenue: number;
  status: string;
  email: string;
  phone?: string;
  address?: string;
  taxId?: string;
}

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [client, setClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClient() {
      try {
        const res = await fetch(firmApiUrl(`/clients/${clientId}`));
        if (res.ok) {
          const data = await res.json();
          setClient(data);
        }
      } catch {
        setClient({
          id: clientId,
          name: 'Acme Corporation',
          businessType: 'C-Corp',
          annualRevenue: 2500000,
          status: 'active',
          email: 'cfo@acme.com',
          phone: '(555) 123-4567',
          address: '123 Business Ave, Suite 100, New York, NY 10001',
          taxId: '12-3456789',
        });
      } finally {
        setLoading(false);
      }
    }
    fetchClient();
  }, [clientId]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'documents', label: 'Documents' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'advisory', label: 'Advisory' },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="card p-6 space-y-4">
          <div className="skeleton h-6 w-64" />
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-4 w-56" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="max-w-7xl mx-auto text-center py-12">
        <p className="text-gray-500">Client not found</p>
        <Link href="/dashboard/clients" className="text-brand-600 hover:text-brand-700 text-sm mt-2 inline-block">
          Back to clients
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard/clients" className="hover:text-gray-700">Clients</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{client.name}</span>
      </div>

      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              <span className={client.status === 'active' ? 'badge-green' : 'badge-blue'}>
                {client.status}
              </span>
            </div>
            <p className="text-gray-500 mt-1">{client.businessType} &middot; {client.email}</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-sm">Edit</button>
            <Link href="/dashboard/advisory" className="btn-primary text-sm">
              Run Scenario
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? 'tab-active' : 'tab-inactive'}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Client Information</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Business Type</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{client.businessType}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Annual Revenue</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{formatCurrency(client.annualRevenue)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Tax ID</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{client.taxId || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Phone</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{client.phone || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Address</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{client.address || 'N/A'}</dd>
              </div>
            </dl>
          </div>

          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Key Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Open Invoices</p>
                <p className="text-xl font-bold text-gray-900 mt-1">3</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Documents</p>
                <p className="text-xl font-bold text-gray-900 mt-1">12</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Scenarios Run</p>
                <p className="text-xl font-bold text-gray-900 mt-1">5</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">Est. Tax Savings</p>
                <p className="text-xl font-bold text-green-600 mt-1">$42K</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
            <Link href="/dashboard/documents" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              Open in Paperless
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {[
              { name: '2024 Tax Return - Draft', type: 'PDF', date: 'Jan 15, 2025' },
              { name: 'Q4 Financial Statements', type: 'XLSX', date: 'Jan 10, 2025' },
              { name: 'W-2 Forms', type: 'PDF', date: 'Jan 5, 2025' },
              { name: 'Business License Renewal', type: 'PDF', date: 'Dec 20, 2024' },
            ].map((doc, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-50 rounded flex items-center justify-center">
                    <span className="text-xs font-medium text-red-600">{doc.type}</span>
                  </div>
                  <span className="text-sm text-gray-900">{doc.name}</span>
                </div>
                <span className="text-xs text-gray-500">{doc.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Invoices</h3>
            <Link href="/dashboard/invoicing" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              Create Invoice
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Invoice #</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { number: '#1042', amount: 3500, status: 'paid', date: 'Jan 10, 2025' },
                  { number: '#1038', amount: 5200, status: 'pending', date: 'Dec 15, 2024' },
                  { number: '#1025', amount: 2800, status: 'paid', date: 'Nov 20, 2024' },
                ].map((inv, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{inv.number}</td>
                    <td className="table-cell">{formatCurrency(inv.amount)}</td>
                    <td className="table-cell">
                      <span className={inv.status === 'paid' ? 'badge-green' : 'badge-yellow'}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500">{inv.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'advisory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Advisory Scenarios</h3>
            <Link href="/dashboard/advisory" className="btn-primary text-sm">
              Run New Scenario
            </Link>
          </div>
          {[
            { question: 'What if we convert from C-Corp to S-Corp?', outcome: 'Estimated annual tax savings of $42,000 based on current revenue.', date: 'Jan 12, 2025' },
            { question: 'Impact of hiring 5 additional employees', outcome: 'Projected payroll increase of $325K; eligible for $15K in tax credits.', date: 'Dec 28, 2024' },
          ].map((scenario, i) => (
            <div key={i} className="card p-5">
              <p className="text-sm font-medium text-gray-900">{scenario.question}</p>
              <p className="text-sm text-gray-600 mt-2">{scenario.outcome}</p>
              <p className="text-xs text-gray-400 mt-2">{scenario.date}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
