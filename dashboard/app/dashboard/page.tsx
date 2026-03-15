'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { apiUrl, firmApiUrl } from '@/lib/api';

// ---------------------------------------------------------------------------
// CPA Dashboard (non-admin users)
// ---------------------------------------------------------------------------
interface Stats {
  totalClients: number;
  activeWorkflows: number;
  pendingInvoices: number;
  upcomingDeadlines: number;
}

function CpaDashboard() {
  const [stats, setStats] = useState<Stats>({ totalClients: 0, activeWorkflows: 0, pendingInvoices: 0, upcomingDeadlines: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(firmApiUrl('/stats'));
        if (res.ok) setStats(await res.json());
      } catch { /* silent */ }
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Your firm overview</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Clients" value={stats.totalClients} loading={loading} color="bg-blue-50 text-blue-600" />
        <StatCard label="Active Workflows" value={stats.activeWorkflows} loading={loading} color="bg-green-50 text-green-600" />
        <StatCard label="Pending Invoices" value={stats.pendingInvoices} loading={loading} color="bg-yellow-50 text-yellow-600" />
        <StatCard label="Deadlines" value={stats.upcomingDeadlines} loading={loading} color="bg-red-50 text-red-600" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/clients" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100">Add Client</Link>
        <Link href="/dashboard/documents" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-600 hover:bg-green-100">Upload Document</Link>
        <Link href="/dashboard/invoicing" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-yellow-50 text-yellow-600 hover:bg-yellow-100">Create Invoice</Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, loading, color }: { label: string; value: number; loading: boolean; color: string }) {
  return (
    <div className="stat-card">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      {loading ? <div className="skeleton h-8 w-20 mt-1" /> : <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin Dashboard — CPA Firm Management
// ---------------------------------------------------------------------------
interface Firm {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
  teamMembers?: { id: string; name: string; email: string; role: string }[];
}

function AdminDashboard() {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddFirm, setShowAddFirm] = useState(false);
  const [form, setForm] = useState({ firmName: '', firmEmail: '', firmPhone: '', adminName: '', adminEmail: '', adminPassword: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchFirms = async () => {
    try {
      const res = await fetch(apiUrl('/api/firms'));
      if (res.ok) {
        const data = await res.json();
        // Fetch details for each firm
        const detailed = await Promise.all(
          data.map(async (f: Firm) => {
            try {
              const r = await fetch(apiUrl(`/api/firms/${f.id}`));
              if (r.ok) return r.json();
            } catch { /* silent */ }
            return f;
          })
        );
        // Filter out the admin firm (firm 1 / admin@maxed.dev)
        setFirms(detailed);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { fetchFirms(); }, []);

  const handleCreateFirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.adminPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(apiUrl('/api/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create firm.');
      } else {
        setShowAddFirm(false);
        setForm({ firmName: '', firmEmail: '', firmPhone: '', adminName: '', adminEmail: '', adminPassword: '' });
        fetchFirms();
      }
    } catch {
      setError('Unable to connect to the server.');
    }
    setCreating(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CPA Firms</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage CPA firm accounts</p>
        </div>
        <button onClick={() => setShowAddFirm(true)} className="btn-primary">
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add CPA Firm
        </button>
      </div>

      {/* Firms List */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-6">
              <div className="skeleton h-5 w-48 mb-2" />
              <div className="skeleton h-4 w-32" />
            </div>
          ))
        ) : firms.length === 0 ? (
          <div className="card p-12 text-center">
            <svg className="mx-auto w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-gray-500 text-lg mb-2">No CPA firms yet</p>
            <p className="text-gray-400 text-sm mb-4">Click &quot;Add CPA Firm&quot; to create your first firm account.</p>
            <button onClick={() => setShowAddFirm(true)} className="btn-primary">Add CPA Firm</button>
          </div>
        ) : (
          firms.map((firm) => (
            <div key={firm.id} className="card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{firm.name}</h3>
                  <p className="text-sm text-gray-500">{firm.email}{firm.phone ? ` | ${firm.phone}` : ''}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Created: {new Date(firm.createdAt).toLocaleDateString()}
                    {firm.teamMembers && ` | ${firm.teamMembers.length} member${firm.teamMembers.length !== 1 ? 's' : ''}`}
                  </p>
                  {firm.teamMembers && firm.teamMembers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {firm.teamMembers.map((m) => (
                        <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
                          {m.name} ({m.email})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Link
                  href={`/dashboard/admin?firmId=${firm.id}`}
                  className="btn-primary text-sm"
                >
                  Setup Services
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Firm Modal */}
      {showAddFirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddFirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Add CPA Firm</h2>
              <button onClick={() => setShowAddFirm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}

            <form onSubmit={handleCreateFirm} className="space-y-4">
              <div className="border-b border-gray-100 pb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Firm Details</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Firm Name</label>
                    <input className="input" value={form.firmName} onChange={(e) => setForm({ ...form, firmName: e.target.value })} placeholder="Smith & Associates CPA" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Firm Email</label>
                    <input className="input" type="email" value={form.firmEmail} onChange={(e) => setForm({ ...form, firmEmail: e.target.value })} placeholder="office@smithcpa.com" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
                    <input className="input" value={form.firmPhone} onChange={(e) => setForm({ ...form, firmPhone: e.target.value })} placeholder="(555) 123-4567" />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Admin User (CPA login)</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input className="input" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} placeholder="John Smith" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email (login)</label>
                    <input className="input" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder="john@smithcpa.com" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input className="input" type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} placeholder="Min. 8 characters" required minLength={8} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddFirm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary flex-1 disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create Firm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page — routes to admin or CPA dashboard based on session
// ---------------------------------------------------------------------------
export default function DashboardHome() {
  const { data: session } = useSession();
  const isAdmin = Boolean((session?.user as any)?.isPlatformAdmin);

  if (isAdmin) return <AdminDashboard />;
  return <CpaDashboard />;
}
