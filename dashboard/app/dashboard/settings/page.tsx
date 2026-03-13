'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiUrl, firmApiUrl } from '@/lib/api';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
}

interface ServiceStatus {
  name: string;
  key: string;
  configured: boolean;
  envVar: string;
}

export default function SettingsPage() {
  const [firmName, setFirmName] = useState('Maxed CPA');
  const [firmEmail, setFirmEmail] = useState('admin@maxed.dev');
  const [firmPhone, setFirmPhone] = useState('(555) 000-1234');
  const [firmAddress, setFirmAddress] = useState('123 Accounting Lane, Suite 200, New York, NY 10001');
  const [saving, setSaving] = useState(false);

  // Team management
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', role: 'staff', password: '' });
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState('');

  // Service status
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  const fetchTeam = useCallback(async () => {
    setLoadingTeam(true);
    try {
      const res = await fetch(firmApiUrl('/team'));
      if (res.ok) {
        setTeamMembers(await res.json());
      }
    } catch { /* silent */ }
    setLoadingTeam(false);
  }, []);

  const fetchServices = useCallback(async () => {
    setLoadingServices(true);
    try {
      const res = await fetch(apiUrl('/api/services/diagnose'));
      if (res.ok) {
        const data = await res.json();
        const serviceList: ServiceStatus[] = [
          { name: 'Bookkeeping (Bigcapital)', key: 'bigcapital', configured: data.bigcapital?.configured, envVar: 'BIGCAPITAL_API_TOKEN' },
          { name: 'Document Management (Paperless)', key: 'paperless', configured: data.paperless?.configured, envVar: 'PAPERLESS_API_TOKEN' },
          { name: 'Invoicing (Invoice Ninja)', key: 'invoiceninja', configured: data.invoiceninja?.configured, envVar: 'INVOICE_NINJA_API_TOKEN' },
          { name: 'Proposals (DocuSeal)', key: 'docuseal', configured: data.docuseal?.configured, envVar: 'DOCUSEAL_API_TOKEN' },
          { name: 'Reporting (Metabase)', key: 'metabase', configured: data.metabase?.configured, envVar: 'METABASE_EMAIL + METABASE_PASSWORD' },
          { name: 'Workflows (n8n)', key: 'n8n', configured: data.n8n?.configured, envVar: 'N8N_API_KEY' },
          { name: 'Team Chat (Mattermost)', key: 'mattermost', configured: data.mattermost?.configured, envVar: 'MATTERMOST_USER + MATTERMOST_PASSWORD' },
          { name: 'Time Tracking (Kimai)', key: 'kimai', configured: data.kimai?.configured, envVar: 'KIMAI_API_TOKEN' },
          { name: 'CRM (Twenty)', key: 'twenty', configured: data.twenty?.configured, envVar: 'TWENTY_API_KEY' },
        ];
        setServices(serviceList);
      }
    } catch { /* silent */ }
    setLoadingServices(false);
  }, []);

  useEffect(() => {
    fetchTeam();
    fetchServices();
  }, [fetchTeam, fetchServices]);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError('');
    if (memberForm.password.length < 8) {
      setMemberError('Password must be at least 8 characters.');
      return;
    }
    setAddingMember(true);
    try {
      const res = await fetch(firmApiUrl('/team'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberForm),
      });
      if (res.ok) {
        setShowAddMember(false);
        setMemberForm({ name: '', email: '', role: 'staff', password: '' });
        fetchTeam();
      } else {
        const data = await res.json();
        setMemberError(data.error || 'Failed to create team member.');
      }
    } catch {
      setMemberError('Unable to connect to the server.');
    }
    setAddingMember(false);
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    try {
      await fetch(firmApiUrl(`/team/${id}`), { method: 'DELETE' });
      fetchTeam();
    } catch { /* silent */ }
  };

  const roleBadge = (role: string) => {
    switch (role) {
      case 'admin': return <span className="badge-blue">Admin</span>;
      case 'partner': return <span className="badge-green">Partner</span>;
      case 'associate': return <span className="badge-yellow">Associate</span>;
      default: return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{role}</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your firm settings, team, and integrations</p>
      </div>

      {/* Firm Info */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Firm Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Firm Name</label>
            <input className="input" value={firmName} onChange={(e) => setFirmName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input className="input" type="email" value={firmEmail} onChange={(e) => setFirmEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input className="input" value={firmPhone} onChange={(e) => setFirmPhone(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input className="input" value={firmAddress} onChange={(e) => setFirmAddress(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Team Members */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Team Members</h2>
            <p className="text-xs text-gray-500 mt-0.5">Create accounts for your team. They can reset their password from the login page.</p>
          </div>
          <button onClick={() => setShowAddMember(true)} className="btn-primary text-sm">
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Member
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {loadingTeam ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-9 h-9 rounded-full" />
                  <div className="space-y-1">
                    <div className="skeleton h-4 w-28" />
                    <div className="skeleton h-3 w-36" />
                  </div>
                </div>
                <div className="skeleton h-5 w-16 rounded-full" />
              </div>
            ))
          ) : teamMembers.length > 0 ? (
            teamMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {member.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.name}</p>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {roleBadge(member.role)}
                  <button
                    onClick={() => handleDeleteMember(member.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove member"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-sm text-gray-500">
              No team members yet. Click &quot;Add Member&quot; to create accounts.
            </div>
          )}
        </div>
      </div>

      {/* Connected Tools */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Service Integrations</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure API tokens in the platform <code className="bg-gray-100 px-1 rounded">.env</code> file to connect services
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {loadingServices ? (
            Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-2.5 h-2.5 rounded-full" />
                  <div className="skeleton h-4 w-40" />
                </div>
                <div className="skeleton h-4 w-20" />
              </div>
            ))
          ) : (
            services.map((svc) => (
              <div key={svc.key} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${svc.configured ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{svc.envVar}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium ${svc.configured ? 'text-green-600' : 'text-gray-400'}`}>
                  {svc.configured ? 'Connected' : 'Not configured'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddMember(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Add Team Member</h2>
              <button onClick={() => setShowAddMember(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {memberError && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {memberError}
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  className="input"
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  placeholder="John Smith"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  className="input"
                  type="email"
                  value={memberForm.email}
                  onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                  placeholder="john@yourfirm.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  className="input"
                  value={memberForm.role}
                  onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                >
                  <option value="staff">Staff</option>
                  <option value="associate">Associate</option>
                  <option value="partner">Partner</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial Password
                </label>
                <input
                  className="input"
                  type="password"
                  value={memberForm.password}
                  onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                />
                <p className="text-xs text-gray-400 mt-1">The user can reset this from the login page.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddMember(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={addingMember} className="btn-primary flex-1 disabled:opacity-50">
                  {addingMember ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
