'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ToolStatus {
  name: string;
  description: string;
  status: 'checking' | 'connected' | 'unreachable';
  url: string;
}

const ROLE_OPTIONS = ['Owner', 'Partner', 'Manager', 'Associate', 'Staff'];

const TOOL_CONFIGS = [
  { name: 'Document Management', description: 'File storage and OCR processing', url: process.env.NEXT_PUBLIC_PAPERLESS_URL || 'http://localhost:8000' },
  { name: 'Invoicing', description: 'Client billing and payments', url: process.env.NEXT_PUBLIC_INVOICE_NINJA_URL || 'http://localhost:8080' },
  { name: 'Proposals', description: 'E-signatures and engagement letters', url: process.env.NEXT_PUBLIC_DOCUSEAL_URL || 'http://localhost:3003' },
  { name: 'Reporting', description: 'Business intelligence dashboards', url: process.env.NEXT_PUBLIC_METABASE_URL || 'http://localhost:3002' },
  { name: 'Workflows', description: 'Process automation', url: process.env.NEXT_PUBLIC_N8N_URL || 'http://localhost:5678' },
  { name: 'Team Chat', description: 'Internal messaging', url: process.env.NEXT_PUBLIC_MATTERMOST_URL || 'http://localhost:8065' },
  { name: 'Time Tracking', description: 'Billable hours and timesheets', url: process.env.NEXT_PUBLIC_KIMAI_URL || 'http://localhost:8001' },
  { name: 'CRM', description: 'Client relationship management', url: process.env.NEXT_PUBLIC_TWENTY_URL || 'http://localhost:3004' },
];

export default function SettingsPage() {
  const [firmName, setFirmName] = useState('Maxed CPA');
  const [firmEmail, setFirmEmail] = useState('admin@maxed.dev');
  const [firmPhone, setFirmPhone] = useState('(555) 000-1234');
  const [firmAddress, setFirmAddress] = useState('123 Accounting Lane, Suite 200, New York, NY 10001');
  const [saving, setSaving] = useState(false);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { id: '1', name: 'Admin User', email: 'admin@maxed.dev', role: 'Owner' },
  ]);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Staff');

  const [tools, setTools] = useState<ToolStatus[]>(
    TOOL_CONFIGS.map((t) => ({ ...t, status: 'checking' as const }))
  );

  // Check tool connectivity on mount
  useEffect(() => {
    TOOL_CONFIGS.forEach((tool, idx) => {
      fetch(tool.url, { mode: 'no-cors', signal: AbortSignal.timeout(5000) })
        .then(() => {
          setTools((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], status: 'connected' };
            return next;
          });
        })
        .catch(() => {
          setTools((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], status: 'unreachable' };
            return next;
          });
        });
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
  };

  const handleInvite = () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setTeamMembers((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
      },
    ]);
    setInviteName('');
    setInviteEmail('');
    setInviteRole('Staff');
    setShowInviteModal(false);
  };

  const handleRemoveMember = (id: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleRoleChange = (id: string, newRole: string) => {
    setTeamMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, role: newRole } : m))
    );
  };

  const roleBadge = (role: string) => {
    switch (role) {
      case 'Owner': return <span className="badge-blue">{role}</span>;
      case 'Partner': return <span className="badge-green">{role}</span>;
      case 'Manager': return <span className="badge-yellow">{role}</span>;
      case 'Associate': return <span className="badge-yellow">{role}</span>;
      default: return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{role}</span>;
    }
  };

  const statusDot = (status: ToolStatus['status']) => {
    if (status === 'checking') return 'bg-yellow-400 animate-pulse';
    if (status === 'connected') return 'bg-green-500';
    return 'bg-red-400';
  };

  const statusLabel = (status: ToolStatus['status']) => {
    if (status === 'checking') return 'Checking...';
    if (status === 'connected') return 'Connected';
    return 'Unreachable';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your firm settings and integrations</p>
      </div>

      {/* Billing Tier */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Current Plan</h2>
            <p className="text-gray-500 text-sm mt-1">You are on the Professional plan</p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-sm font-semibold">
              <Image src="/maxed_acc_logo.png" alt="" width={16} height={16} className="w-4 h-4 object-contain" />
              Pro
            </span>
            <p className="text-xs text-gray-500 mt-1">$199/month</p>
          </div>
        </div>
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
            <p className="text-xs text-gray-500 mt-0.5">{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowInviteModal(true)} className="btn-primary text-sm">
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Member
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {teamMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">
                    {member.name.split(' ').map((n) => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700 bg-white"
                  disabled={member.role === 'Owner'}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {member.role !== 'Owner' && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove member"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowInviteModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Team Member</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  className="input"
                  placeholder="Jane Smith"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="jane@firm.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  className="input"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  {ROLE_OPTIONS.filter((r) => r !== 'Owner').map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowInviteModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleInvite} className="btn-primary">
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connected Services */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Connected Services</h2>
          <p className="text-xs text-gray-500 mt-0.5">Status of integrated platform modules</p>
        </div>
        <div className="divide-y divide-gray-100">
          {tools.map((tool) => (
            <div key={tool.name} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${statusDot(tool.status)}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{tool.name}</p>
                  <p className="text-xs text-gray-400">{tool.description}</p>
                </div>
              </div>
              <span className={`text-xs font-medium ${
                tool.status === 'connected' ? 'text-green-600' :
                tool.status === 'checking' ? 'text-yellow-600' : 'text-red-500'
              }`}>
                {statusLabel(tool.status)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
