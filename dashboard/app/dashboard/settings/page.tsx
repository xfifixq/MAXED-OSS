'use client';

import { useState } from 'react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ToolStatus {
  name: string;
  url: string;
  envVar: string;
  connected: boolean;
}

export default function SettingsPage() {
  const [firmName, setFirmName] = useState('Maxed CPA');
  const [firmEmail, setFirmEmail] = useState('admin@maxed.dev');
  const [firmPhone, setFirmPhone] = useState('(555) 000-1234');
  const [firmAddress, setFirmAddress] = useState('123 Accounting Lane, Suite 200, New York, NY 10001');
  const [saving, setSaving] = useState(false);

  const teamMembers: TeamMember[] = [
    { id: '1', name: 'Admin User', email: 'admin@maxed.dev', role: 'Owner' },
    { id: '2', name: 'Sarah Johnson', email: 'sarah@maxed.dev', role: 'Partner' },
    { id: '3', name: 'Mike Chen', email: 'mike@maxed.dev', role: 'Associate' },
    { id: '4', name: 'Lisa Park', email: 'lisa@maxed.dev', role: 'Staff' },
  ];

  const tools: ToolStatus[] = [
    { name: 'Bookkeeping', url: process.env.NEXT_PUBLIC_BIGCAPITAL_URL || 'http://localhost:3001', envVar: 'NEXT_PUBLIC_BIGCAPITAL_URL', connected: true },
    { name: 'Document Management', url: process.env.NEXT_PUBLIC_PAPERLESS_URL || 'http://localhost:8000', envVar: 'NEXT_PUBLIC_PAPERLESS_URL', connected: true },
    { name: 'Invoicing', url: process.env.NEXT_PUBLIC_INVOICE_NINJA_URL || 'http://localhost:8080', envVar: 'NEXT_PUBLIC_INVOICE_NINJA_URL', connected: true },
    { name: 'Proposals & E-Signatures', url: process.env.NEXT_PUBLIC_DOCUSEAL_URL || 'http://localhost:3003', envVar: 'NEXT_PUBLIC_DOCUSEAL_URL', connected: true },
    { name: 'Reporting & Analytics', url: process.env.NEXT_PUBLIC_METABASE_URL || 'http://localhost:3002', envVar: 'NEXT_PUBLIC_METABASE_URL', connected: true },
    { name: 'Workflow Automation', url: process.env.NEXT_PUBLIC_N8N_URL || 'http://localhost:5678', envVar: 'NEXT_PUBLIC_N8N_URL', connected: true },
    { name: 'Team Chat', url: process.env.NEXT_PUBLIC_MATTERMOST_URL || 'http://localhost:8065', envVar: 'NEXT_PUBLIC_MATTERMOST_URL', connected: true },
    { name: 'Time Tracking', url: process.env.NEXT_PUBLIC_KIMAI_URL || 'http://localhost:8001', envVar: 'NEXT_PUBLIC_KIMAI_URL', connected: true },
    { name: 'CRM', url: process.env.NEXT_PUBLIC_TWENTY_URL || 'http://localhost:3004', envVar: 'NEXT_PUBLIC_TWENTY_URL', connected: true },
  ];

  const handleSave = async () => {
    setSaving(true);
    // Simulate save
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
  };

  const roleBadge = (role: string) => {
    switch (role) {
      case 'Owner': return <span className="badge-blue">{role}</span>;
      case 'Partner': return <span className="badge-green">{role}</span>;
      case 'Associate': return <span className="badge-yellow">{role}</span>;
      default: return <span className="badge">{role}</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your firm settings and integrations</p>
      </div>

      {/* Firm Info */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Firm Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Firm Name</label>
            <input
              className="input"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              className="input"
              type="email"
              value={firmEmail}
              onChange={(e) => setFirmEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              className="input"
              value={firmPhone}
              onChange={(e) => setFirmPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              className="input"
              value={firmAddress}
              onChange={(e) => setFirmAddress(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Team Members */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Team Members</h2>
          <button className="btn-primary text-sm">
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite Member
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
              {roleBadge(member.role)}
            </div>
          ))}
        </div>
      </div>

      {/* Connected Tools */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Connected Tools</h2>
          <p className="text-xs text-gray-500 mt-0.5">Status of integrated services</p>
        </div>
        <div className="divide-y divide-gray-100">
          {tools.map((tool) => (
            <div key={tool.name} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    tool.connected ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{tool.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{tool.url}</p>
                </div>
              </div>
              <span
                className={`text-xs font-medium ${
                  tool.connected ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {tool.connected ? 'Connected' : 'Not connected'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
