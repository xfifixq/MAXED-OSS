'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { apiUrl } from '@/lib/api';

interface Firm {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
}

interface Credential {
  service: string;
  token: string | null;
  username: string | null;
  password: string | null;
  metadata: string | null;
}

const SERVICE_CONFIGS = [
  { key: 'paperless', name: 'Document Management (Paperless)', fields: ['token'], labels: { token: 'API Token' } },
  { key: 'docuseal', name: 'Proposals & E-Signatures (DocuSeal)', fields: ['token'], labels: { token: 'API Token' } },
  { key: 'invoiceninja', name: 'Invoicing (Invoice Ninja)', fields: ['token'], labels: { token: 'API Token' } },
  { key: 'n8n', name: 'Workflows (n8n)', fields: ['token'], labels: { token: 'API Key' } },
  { key: 'kimai', name: 'Time Tracking (Kimai)', fields: ['username', 'token'], labels: { username: 'Email', token: 'API Token' } },
  { key: 'bigcapital', name: 'Bookkeeping (Bigcapital)', fields: ['token', 'metadata'], labels: { token: 'API Token', metadata: 'Tenant ID' } },
  { key: 'twenty', name: 'CRM (Twenty)', fields: ['token'], labels: { token: 'API Key' } },
  { key: 'metabase', name: 'Reporting (Metabase)', fields: ['username', 'password'], labels: { username: 'Email', password: 'Password' } },
  { key: 'mattermost', name: 'Team Chat (Mattermost)', fields: ['username', 'password'], labels: { username: 'Username', password: 'Password' } },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = Boolean((session?.user as any)?.isPlatformAdmin);

  // Firms list (admin only)
  const [firms, setFirms] = useState<Firm[]>([]);
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [loadingFirms, setLoadingFirms] = useState(true);

  // Credentials for selected firm
  const [credentials, setCredentials] = useState<Record<string, Credential>>({});
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [credForm, setCredForm] = useState<Record<string, string>>({});
  const [savingCred, setSavingCred] = useState(false);
  const [credMessage, setCredMessage] = useState('');

  // Fetch all firms
  const fetchFirms = useCallback(async () => {
    setLoadingFirms(true);
    try {
      const res = await fetch(apiUrl('/api/firms'));
      if (res.ok) {
        const data = await res.json();
        setFirms(data);
        // Auto-select first non-admin firm, or first firm
        if (data.length > 0 && !selectedFirmId) {
          setSelectedFirmId(data[0].id);
        }
      }
    } catch { /* silent */ }
    setLoadingFirms(false);
  }, [selectedFirmId]);

  // Fetch credentials for selected firm
  const fetchCredentials = useCallback(async (firmId: string) => {
    if (!firmId) return;
    setLoadingCreds(true);
    try {
      const res = await fetch(apiUrl(`/api/firms/${firmId}/credentials`));
      if (res.ok) {
        const data = await res.json();
        const credMap: Record<string, Credential> = {};
        data.forEach((c: Credential) => { credMap[c.service] = c; });
        setCredentials(credMap);
      }
    } catch { /* silent */ }
    setLoadingCreds(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchFirms();
  }, [isAdmin, fetchFirms]);

  useEffect(() => {
    if (selectedFirmId) fetchCredentials(selectedFirmId);
  }, [selectedFirmId, fetchCredentials]);

  const handleEditService = (serviceKey: string) => {
    const existing = credentials[serviceKey];
    const config = SERVICE_CONFIGS.find((s) => s.key === serviceKey);
    const form: Record<string, string> = {};
    config?.fields.forEach((f) => {
      // Don't pre-fill masked values
      form[f] = '';
    });
    if (existing?.username) form.username = existing.username;
    if (existing?.metadata) form.metadata = existing.metadata;
    setCredForm(form);
    setEditingService(serviceKey);
    setCredMessage('');
  };

  const handleSaveCredential = async (serviceKey: string) => {
    setSavingCred(true);
    setCredMessage('');
    try {
      const res = await fetch(apiUrl(`/api/firms/${selectedFirmId}/credentials/${serviceKey}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credForm),
      });
      if (res.ok) {
        setCredMessage('Saved!');
        setEditingService(null);
        fetchCredentials(selectedFirmId);
      } else {
        const data = await res.json();
        setCredMessage(data.error || 'Failed to save.');
      }
    } catch {
      setCredMessage('Unable to connect to the server.');
    }
    setSavingCred(false);
  };

  const handleDeleteCredential = async (serviceKey: string) => {
    if (!confirm(`Remove credentials for this service?`)) return;
    try {
      await fetch(apiUrl(`/api/firms/${selectedFirmId}/credentials/${serviceKey}`), { method: 'DELETE' });
      fetchCredentials(selectedFirmId);
    } catch { /* silent */ }
  };

  const selectedFirm = firms.find((f) => f.id === selectedFirmId);

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Contact your administrator for account changes.</p>
        </div>
        <div className="card p-8 text-center text-gray-500">
          Only administrators can manage firm settings and service credentials.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage CPA firms and their service credentials</p>
      </div>

      {/* Firm Selector */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Select CPA Firm</h2>
        {loadingFirms ? (
          <div className="skeleton h-10 w-full rounded-lg" />
        ) : firms.length === 0 ? (
          <p className="text-sm text-gray-500">No firms registered yet. CPA firms will appear here after they sign up.</p>
        ) : (
          <select
            className="input"
            value={selectedFirmId}
            onChange={(e) => setSelectedFirmId(e.target.value)}
          >
            {firms.map((firm) => (
              <option key={firm.id} value={firm.id}>
                {firm.name} ({firm.email})
              </option>
            ))}
          </select>
        )}
        {selectedFirm && (
          <div className="mt-3 text-xs text-gray-400">
            Firm ID: {selectedFirm.id} | Registered: {new Date(selectedFirm.createdAt).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Service Credentials */}
      {selectedFirmId && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Service Credentials for {selectedFirm?.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Enter the API tokens or login credentials you created for this firm on each service
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {loadingCreds ? (
              Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-3">
                  <div className="skeleton h-4 w-48" />
                  <div className="skeleton h-4 w-20" />
                </div>
              ))
            ) : (
              SERVICE_CONFIGS.map((svc) => {
                const cred = credentials[svc.key];
                const isConfigured = cred && (cred.token || cred.username);
                const isEditing = editingService === svc.key;

                return (
                  <div key={svc.key} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                          <p className="text-xs text-gray-400">
                            {isConfigured ? 'Credentials configured' : 'Not configured'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isConfigured && !isEditing && (
                          <button
                            onClick={() => handleDeleteCredential(svc.key)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Remove
                          </button>
                        )}
                        <button
                          onClick={() => isEditing ? setEditingService(null) : handleEditService(svc.key)}
                          className="text-xs font-medium text-brand-600 hover:text-brand-700"
                        >
                          {isEditing ? 'Cancel' : isConfigured ? 'Update' : 'Configure'}
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-3 space-y-3 pl-5 border-l-2 border-brand-200">
                        {svc.fields.map((field) => (
                          <div key={field}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {svc.labels[field as keyof typeof svc.labels] || field}
                            </label>
                            <input
                              className="input text-sm"
                              type={field === 'password' || field === 'token' ? 'password' : 'text'}
                              value={credForm[field] || ''}
                              onChange={(e) => setCredForm({ ...credForm, [field]: e.target.value })}
                              placeholder={isConfigured ? '(leave blank to keep current)' : `Enter ${svc.labels[field as keyof typeof svc.labels] || field}`}
                            />
                          </div>
                        ))}
                        {credMessage && (
                          <p className={`text-xs ${credMessage === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>
                            {credMessage}
                          </p>
                        )}
                        <button
                          onClick={() => handleSaveCredential(svc.key)}
                          disabled={savingCred}
                          className="btn-primary text-sm disabled:opacity-50"
                        >
                          {savingCred ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Quick Link to Admin Service Setup */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Need to create service accounts?</h2>
        <p className="text-sm text-gray-500 mb-3">
          Use the Admin panel to access each service directly and create accounts for CPA firms.
        </p>
        <a href="/dashboard/admin" className="btn-primary text-sm inline-block">
          Open Admin Panel
        </a>
      </div>
    </div>
  );
}
