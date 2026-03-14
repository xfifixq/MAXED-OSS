'use client';

import { useEffect, useState } from 'react';
import { apiUrl, firmApiUrl, serviceHeaders } from '@/lib/api';

interface Dashboard {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
}

interface Question {
  id: number;
  name: string;
  description?: string;
  display: string;
  created_at?: string;
}

interface FirmStats {
  totalClients: number;
  pendingInvoices: number;
  invoiceCount: number;
  docCount: number;
  scenarioCount: number;
  totalRevenue: number;
}

const PLACEHOLDER_DASHBOARDS: Dashboard[] = [
  { id: 1, name: 'Revenue Overview', description: 'Monthly and quarterly revenue trends', created_at: '2026-01-15' },
  { id: 2, name: 'Client Analytics', description: 'Client growth and retention metrics', created_at: '2026-02-01' },
  { id: 3, name: 'Tax Season Tracker', description: 'Filing progress and deadlines', created_at: '2026-02-15' },
  { id: 4, name: 'Team Performance', description: 'Billable hours and utilization rates', created_at: '2026-03-01' },
];

const PLACEHOLDER_QUESTIONS: Question[] = [
  { id: 1, name: 'Monthly Revenue by Client', display: 'bar', description: 'Revenue breakdown per client per month' },
  { id: 2, name: 'Invoice Aging Report', display: 'table', description: 'Outstanding invoices grouped by age' },
  { id: 3, name: 'Client Count Over Time', display: 'line', description: 'Growth in client base' },
  { id: 4, name: 'Top 10 Clients by Revenue', display: 'pie', description: 'Revenue concentration analysis' },
  { id: 5, name: 'Billable Hours by Team Member', display: 'bar', description: 'Time tracking summary per person' },
  { id: 6, name: 'Document Upload Trends', display: 'line', description: 'Document volume over time' },
];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

function ChartIcon({ type }: { type: string }) {
  if (type === 'bar') return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
  if (type === 'line') return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  );
  if (type === 'pie') return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  );
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

export default function ReportingPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<FirmStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // Fetch firm stats
      try {
        const sRes = await fetch(firmApiUrl('/stats'));
        if (sRes.ok) setStats(await sRes.json());
      } catch { /* silent */ }

      // Fetch Metabase dashboards and questions
      try {
        const [dRes, qRes] = await Promise.all([
          fetch(apiUrl('/api/services/metabase/dashboards'), { headers: serviceHeaders() }),
          fetch(apiUrl('/api/services/metabase/questions'), { headers: serviceHeaders() }),
        ]);
        if (dRes.ok) {
          const d = await dRes.json();
          setDashboards(Array.isArray(d) ? d : d.data || PLACEHOLDER_DASHBOARDS);
        } else setDashboards(PLACEHOLDER_DASHBOARDS);
        if (qRes.ok) {
          const d = await qRes.json();
          setQuestions(Array.isArray(d) ? d : d.data || PLACEHOLDER_QUESTIONS);
        } else setQuestions(PLACEHOLDER_QUESTIONS);
      } catch {
        setDashboards(PLACEHOLDER_DASHBOARDS);
        setQuestions(PLACEHOLDER_QUESTIONS);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reporting & Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Firm performance metrics and business intelligence</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm font-medium text-gray-500">Total Clients</p>
          {loading ? <div className="skeleton h-8 w-12 mt-1" /> : <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalClients ?? 24}</p>}
        </div>
        <div className="stat-card">
          <p className="text-sm font-medium text-gray-500">Total Revenue</p>
          {loading ? <div className="skeleton h-8 w-28 mt-1" /> : <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats?.totalRevenue ?? 330000)}</p>}
        </div>
        <div className="stat-card">
          <p className="text-sm font-medium text-gray-500">Pending Invoices</p>
          {loading ? <div className="skeleton h-8 w-12 mt-1" /> : <p className="text-2xl font-bold text-yellow-600 mt-1">{stats?.pendingInvoices ?? 12}</p>}
        </div>
        <div className="stat-card">
          <p className="text-sm font-medium text-gray-500">Documents</p>
          {loading ? <div className="skeleton h-8 w-12 mt-1" /> : <p className="text-2xl font-bold text-brand-600 mt-1">{stats?.docCount ?? 156}</p>}
        </div>
      </div>

      {/* Dashboards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Dashboards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5 space-y-3">
                <div className="skeleton h-5 w-32" />
                <div className="skeleton h-4 w-full" />
              </div>
            ))
          ) : (
            dashboards.map((d) => (
              <div key={d.id} className="card p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900">{d.name}</h3>
                {d.description && <p className="text-xs text-gray-500 mt-1">{d.description}</p>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Saved Questions / Reports */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Saved Reports</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header">Report</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="table-cell"><div className="skeleton h-4 w-40" /></td>
                      <td className="table-cell"><div className="skeleton h-4 w-16" /></td>
                      <td className="table-cell"><div className="skeleton h-4 w-48" /></td>
                    </tr>
                  ))
                ) : questions.length > 0 ? (
                  questions.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50 cursor-pointer">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <span className="text-brand-500"><ChartIcon type={q.display} /></span>
                          <span className="font-medium text-gray-900">{q.name}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 capitalize">{q.display}</span>
                      </td>
                      <td className="table-cell text-gray-500 text-sm">{q.description || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">No saved reports</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
