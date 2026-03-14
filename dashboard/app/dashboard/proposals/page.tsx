'use client';

import { useEffect, useState } from 'react';
import { apiUrl, serviceHeaders } from '@/lib/api';

interface Template {
  id: number | string;
  name: string;
  created_at: string;
  fields?: unknown[];
}

interface Submission {
  id: number | string;
  template?: { id: number; name: string };
  template_name?: string;
  status: string;
  created_at: string;
  completed_at?: string;
  submitters?: { email: string; status: string }[];
}

const TABS = ['Submissions', 'Templates'] as const;
type Tab = typeof TABS[number];

const PLACEHOLDER_TEMPLATES: Template[] = [
  { id: 1, name: 'Engagement Letter', created_at: '2026-01-15T10:00:00Z', fields: [{}, {}, {}] },
  { id: 2, name: 'Tax Preparation Agreement', created_at: '2026-02-01T09:00:00Z', fields: [{}, {}, {}, {}] },
  { id: 3, name: 'Advisory Services Proposal', created_at: '2026-02-20T14:00:00Z', fields: [{}, {}] },
  { id: 4, name: 'NDA - Confidentiality Agreement', created_at: '2026-03-01T11:00:00Z', fields: [{}, {}, {}] },
];

const PLACEHOLDER_SUBMISSIONS: Submission[] = [
  { id: 1, template_name: 'Engagement Letter', status: 'completed', created_at: '2026-03-10T09:00:00Z', completed_at: '2026-03-10T14:30:00Z', submitters: [{ email: 'cfo@acme.com', status: 'completed' }] },
  { id: 2, template_name: 'Tax Preparation Agreement', status: 'pending', created_at: '2026-03-11T10:00:00Z', submitters: [{ email: 'admin@techstart.io', status: 'pending' }] },
  { id: 3, template_name: 'Advisory Services Proposal', status: 'opened', created_at: '2026-03-11T15:00:00Z', submitters: [{ email: 'jbaker@bakerllc.com', status: 'opened' }] },
  { id: 4, template_name: 'Engagement Letter', status: 'completed', created_at: '2026-03-08T08:00:00Z', completed_at: '2026-03-09T11:00:00Z', submitters: [{ email: 'info@summitpartners.com', status: 'completed' }] },
  { id: 5, template_name: 'NDA - Confidentiality Agreement', status: 'expired', created_at: '2026-02-15T09:00:00Z', submitters: [{ email: 'owner@greenleaf.co', status: 'expired' }] },
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === 'completed') return <span className="badge-green">Completed</span>;
  if (s === 'pending') return <span className="badge-yellow">Pending</span>;
  if (s === 'opened') return <span className="badge-blue">Opened</span>;
  if (s === 'expired') return <span className="badge-red">Expired</span>;
  return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{status}</span>;
}

export default function ProposalsPage() {
  const [tab, setTab] = useState<Tab>('Submissions');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({ templateId: '', email: '' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [tRes, sRes] = await Promise.all([
          fetch(apiUrl('/api/services/docuseal/templates'), { headers: serviceHeaders() }),
          fetch(apiUrl('/api/services/docuseal/submissions'), { headers: serviceHeaders() }),
        ]);
        if (tRes.ok) {
          const d = await tRes.json();
          setTemplates(Array.isArray(d) ? d : d.data || PLACEHOLDER_TEMPLATES);
        } else setTemplates(PLACEHOLDER_TEMPLATES);
        if (sRes.ok) {
          const d = await sRes.json();
          setSubmissions(Array.isArray(d) ? d : d.data || PLACEHOLDER_SUBMISSIONS);
        } else setSubmissions(PLACEHOLDER_SUBMISSIONS);
      } catch {
        setTemplates(PLACEHOLDER_TEMPLATES);
        setSubmissions(PLACEHOLDER_SUBMISSIONS);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const stats = {
    total: submissions.length,
    pending: submissions.filter(s => s.status === 'pending' || s.status === 'opened').length,
    completed: submissions.filter(s => s.status === 'completed').length,
    expired: submissions.filter(s => s.status === 'expired').length,
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await fetch(apiUrl('/api/services/docuseal/submissions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...serviceHeaders() },
        body: JSON.stringify({
          template_id: parseInt(sendForm.templateId),
          submitters: [{ email: sendForm.email }],
        }),
      });
      setShowSendModal(false);
      setSendForm({ templateId: '', email: '' });
    } catch { /* silent */ }
    setSending(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proposals & E-Signatures</h1>
          <p className="text-gray-500 text-sm mt-1">Send proposals and collect signatures</p>
        </div>
        <button onClick={() => setShowSendModal(true)} className="btn-primary">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Send Proposal
        </button>
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

      {tab === 'Submissions' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <p className="text-sm font-medium text-gray-500">Total Sent</p>
              {loading ? <div className="skeleton h-8 w-12 mt-1" /> : <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>}
            </div>
            <div className="stat-card">
              <p className="text-sm font-medium text-gray-500">Awaiting Signature</p>
              {loading ? <div className="skeleton h-8 w-12 mt-1" /> : <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>}
            </div>
            <div className="stat-card">
              <p className="text-sm font-medium text-gray-500">Completed</p>
              {loading ? <div className="skeleton h-8 w-12 mt-1" /> : <p className="text-2xl font-bold text-green-600 mt-1">{stats.completed}</p>}
            </div>
            <div className="stat-card">
              <p className="text-sm font-medium text-gray-500">Expired</p>
              {loading ? <div className="skeleton h-8 w-12 mt-1" /> : <p className="text-2xl font-bold text-red-600 mt-1">{stats.expired}</p>}
            </div>
          </div>

          {/* Submissions Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="table-header">Template</th>
                    <th className="table-header">Sent To</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Sent Date</th>
                    <th className="table-header">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        <td className="table-cell"><div className="skeleton h-4 w-36" /></td>
                        <td className="table-cell"><div className="skeleton h-4 w-32" /></td>
                        <td className="table-cell"><div className="skeleton h-5 w-20 rounded-full" /></td>
                        <td className="table-cell"><div className="skeleton h-4 w-24" /></td>
                        <td className="table-cell"><div className="skeleton h-4 w-24" /></td>
                      </tr>
                    ))
                  ) : submissions.length > 0 ? (
                    submissions.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="table-cell font-medium text-gray-900">{s.template?.name || s.template_name || '-'}</td>
                        <td className="table-cell text-gray-500">{s.submitters?.[0]?.email || '-'}</td>
                        <td className="table-cell"><StatusBadge status={s.status} /></td>
                        <td className="table-cell text-gray-500 text-sm">{formatDate(s.created_at)}</td>
                        <td className="table-cell text-gray-500 text-sm">{s.completed_at ? formatDate(s.completed_at) : '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No submissions yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'Templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-6 space-y-3">
                <div className="skeleton h-5 w-40" />
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-8 w-28 mt-2" />
              </div>
            ))
          ) : templates.length > 0 ? (
            templates.map((t) => (
              <div key={t.id} className="card p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900">{t.name}</h3>
                <p className="text-xs text-gray-500 mt-1">Created {formatDate(t.created_at)}</p>
                {t.fields && <p className="text-xs text-gray-400">{t.fields.length} fields</p>}
                <button
                  onClick={() => {
                    setSendForm({ templateId: String(t.id), email: '' });
                    setShowSendModal(true);
                  }}
                  className="btn-primary text-sm mt-4"
                >
                  Use Template
                </button>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-gray-500">No templates available</div>
          )}
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSendModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Send Proposal</h2>
              <button onClick={() => setShowSendModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                <select
                  className="input"
                  value={sendForm.templateId}
                  onChange={(e) => setSendForm({ ...sendForm, templateId: e.target.value })}
                  required
                >
                  <option value="">Select a template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
                <input
                  className="input"
                  type="email"
                  value={sendForm.email}
                  onChange={(e) => setSendForm({ ...sendForm, email: e.target.value })}
                  placeholder="client@example.com"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSendModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={sending} className="btn-primary flex-1 disabled:opacity-50">
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
