'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';

interface Workflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes?: unknown[];
}

interface Execution {
  id: string;
  workflowId?: string;
  workflowName?: string;
  finished: boolean;
  startedAt: string;
  stoppedAt?: string;
  status: string;
}

const TABS = ['Workflows', 'Executions'] as const;
type Tab = typeof TABS[number];

const PLACEHOLDER_WORKFLOWS: Workflow[] = [
  { id: '1', name: 'Client Onboarding', active: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-10T15:00:00Z', nodes: [{}, {}, {}, {}] },
  { id: '2', name: 'Invoice Reminder (7 days overdue)', active: true, createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-03-12T08:00:00Z', nodes: [{}, {}, {}] },
  { id: '3', name: 'Document Processing Pipeline', active: true, createdAt: '2026-02-01T11:00:00Z', updatedAt: '2026-03-11T09:00:00Z', nodes: [{}, {}, {}, {}, {}] },
  { id: '4', name: 'Tax Deadline Alert', active: false, createdAt: '2026-02-15T14:00:00Z', updatedAt: '2026-03-01T10:00:00Z', nodes: [{}, {}] },
  { id: '5', name: 'Monthly Financial Report', active: true, createdAt: '2026-03-01T08:00:00Z', updatedAt: '2026-03-12T06:00:00Z', nodes: [{}, {}, {}] },
];

const PLACEHOLDER_EXECUTIONS: Execution[] = [
  { id: '1', workflowName: 'Client Onboarding', finished: true, startedAt: '2026-03-12T14:30:00Z', stoppedAt: '2026-03-12T14:30:45Z', status: 'success' },
  { id: '2', workflowName: 'Invoice Reminder', finished: true, startedAt: '2026-03-12T08:00:00Z', stoppedAt: '2026-03-12T08:00:12Z', status: 'success' },
  { id: '3', workflowName: 'Document Processing', finished: true, startedAt: '2026-03-11T16:00:00Z', stoppedAt: '2026-03-11T16:02:30Z', status: 'error' },
  { id: '4', workflowName: 'Monthly Financial Report', finished: true, startedAt: '2026-03-01T06:00:00Z', stoppedAt: '2026-03-01T06:05:00Z', status: 'success' },
  { id: '5', workflowName: 'Client Onboarding', finished: true, startedAt: '2026-03-10T11:00:00Z', stoppedAt: '2026-03-10T11:01:00Z', status: 'success' },
  { id: '6', workflowName: 'Invoice Reminder', finished: true, startedAt: '2026-03-10T08:00:00Z', stoppedAt: '2026-03-10T08:00:08Z', status: 'success' },
  { id: '7', workflowName: 'Document Processing', finished: false, startedAt: '2026-03-12T16:00:00Z', status: 'running' },
  { id: '8', workflowName: 'Tax Deadline Alert', finished: true, startedAt: '2026-03-09T09:00:00Z', stoppedAt: '2026-03-09T09:00:05Z', status: 'success' },
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(start: string, end?: string) {
  if (!end) return 'Running...';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function ExecutionBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === 'success') return <span className="badge-green">Success</span>;
  if (s === 'error') return <span className="badge-red">Error</span>;
  if (s === 'running') return <span className="badge-blue">Running</span>;
  if (s === 'waiting') return <span className="badge-yellow">Waiting</span>;
  return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{status}</span>;
}

export default function WorkflowsPage() {
  const [tab, setTab] = useState<Tab>('Workflows');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [wRes, eRes] = await Promise.all([
          fetch(apiUrl('/api/services/n8n/workflows')),
          fetch(apiUrl('/api/services/n8n/executions')),
        ]);
        if (wRes.ok) {
          const d = await wRes.json();
          setWorkflows(d.data || (Array.isArray(d) ? d : PLACEHOLDER_WORKFLOWS));
        } else setWorkflows(PLACEHOLDER_WORKFLOWS);
        if (eRes.ok) {
          const d = await eRes.json();
          setExecutions(d.data || (Array.isArray(d) ? d : PLACEHOLDER_EXECUTIONS));
        } else setExecutions(PLACEHOLDER_EXECUTIONS);
      } catch {
        setWorkflows(PLACEHOLDER_WORKFLOWS);
        setExecutions(PLACEHOLDER_EXECUTIONS);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleToggle = async (id: string) => {
    try {
      await fetch(apiUrl(`/api/services/n8n/workflows/${id}/activate`), { method: 'POST' });
      setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, active: !w.active } : w)));
    } catch { /* silent */ }
  };

  const stats = {
    total: workflows.length,
    active: workflows.filter(w => w.active).length,
    inactive: workflows.filter(w => !w.active).length,
    recentExecs: executions.filter(e => {
      const d = new Date(e.startedAt);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Workflow Automation</h1>
        <p className="text-gray-500 text-sm mt-1">Automate your firm&apos;s repetitive tasks</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'Workflows' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <p className="text-sm font-medium text-gray-500">Total Workflows</p>
              {loading ? <div className="skeleton h-8 w-12 mt-1" /> : <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>}
            </div>
            <div className="stat-card">
              <p className="text-sm font-medium text-gray-500">Active</p>
              {loading ? <div className="skeleton h-8 w-12 mt-1" /> : <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>}
            </div>
            <div className="stat-card">
              <p className="text-sm font-medium text-gray-500">Inactive</p>
              {loading ? <div className="skeleton h-8 w-12 mt-1" /> : <p className="text-2xl font-bold text-gray-400 mt-1">{stats.inactive}</p>}
            </div>
            <div className="stat-card">
              <p className="text-sm font-medium text-gray-500">Executions Today</p>
              {loading ? <div className="skeleton h-8 w-12 mt-1" /> : <p className="text-2xl font-bold text-brand-600 mt-1">{stats.recentExecs}</p>}
            </div>
          </div>

          {/* Workflow Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card p-5 space-y-3">
                  <div className="skeleton h-5 w-40" />
                  <div className="skeleton h-4 w-24" />
                  <div className="skeleton h-8 w-16 mt-2" />
                </div>
              ))
            ) : workflows.map((w) => (
              <div key={w.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(w.id)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${w.active ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${w.active ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
                <h3 className="font-semibold text-gray-900">{w.name}</h3>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>{w.nodes?.length || 0} nodes</span>
                  <span>Updated {formatDate(w.updatedAt)}</span>
                </div>
                <div className="mt-2">
                  {w.active ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />Inactive
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Executions' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header">Workflow</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Started</th>
                  <th className="table-header">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="table-cell"><div className="skeleton h-4 w-36" /></td>
                      <td className="table-cell"><div className="skeleton h-5 w-16 rounded-full" /></td>
                      <td className="table-cell"><div className="skeleton h-4 w-28" /></td>
                      <td className="table-cell"><div className="skeleton h-4 w-16" /></td>
                    </tr>
                  ))
                ) : executions.length > 0 ? (
                  executions.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium text-gray-900">{e.workflowName || `Workflow ${e.workflowId}`}</td>
                      <td className="table-cell"><ExecutionBadge status={e.status} /></td>
                      <td className="table-cell text-gray-500 text-sm">
                        {new Date(e.startedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </td>
                      <td className="table-cell text-gray-500 text-sm">{formatDuration(e.startedAt, e.stoppedAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">No executions yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
