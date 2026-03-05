'use client';

import { useEffect, useState } from 'react';
import { firmApiUrl } from '@/lib/api';

interface Scenario {
  id: string;
  clientName: string;
  question: string;
  outcome: string;
  status: string;
  createdAt: string;
}

interface Client {
  id: string;
  name: string;
}

export default function AdvisoryPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ clientId: '', question: '' });

  useEffect(() => {
    async function fetchData() {
      try {
        const [scenariosRes, clientsRes] = await Promise.allSettled([
          fetch(firmApiUrl('/scenarios')),
          fetch(firmApiUrl('/clients')),
        ]);

        if (scenariosRes.status === 'fulfilled' && scenariosRes.value.ok) {
          const data = await scenariosRes.value.json();
          setScenarios(Array.isArray(data) ? data : data.scenarios || []);
        }

        if (clientsRes.status === 'fulfilled' && clientsRes.value.ok) {
          const data = await clientsRes.value.json();
          setClients(Array.isArray(data) ? data : data.clients || []);
        }
      } catch {
        // Placeholder data
        setClients([
          { id: '1', name: 'Acme Corporation' },
          { id: '2', name: 'TechStart Inc' },
          { id: '3', name: 'Baker & Associates LLC' },
        ]);
        setScenarios([
          {
            id: '1',
            clientName: 'Acme Corporation',
            question: 'What if we convert from C-Corp to S-Corp?',
            outcome: 'Estimated annual tax savings of $42,000 based on current revenue of $2.5M. The S-Corp election would reduce self-employment taxes and allow for reasonable salary distributions.',
            status: 'completed',
            createdAt: '2025-01-12',
          },
          {
            id: '2',
            clientName: 'TechStart Inc',
            question: 'Impact of R&D tax credit on our software development costs?',
            outcome: 'Eligible for approximately $18,500 in R&D tax credits based on $185K in qualifying research expenses. Recommend documenting all eligible activities for audit trail.',
            status: 'completed',
            createdAt: '2025-01-08',
          },
          {
            id: '3',
            clientName: 'Baker & Associates LLC',
            question: 'Should we elect for Section 179 on new equipment purchases?',
            outcome: 'Section 179 deduction of $125,000 on planned equipment purchases would reduce taxable income significantly. Recommend timing purchases before year-end.',
            status: 'completed',
            createdAt: '2024-12-28',
          },
          {
            id: '4',
            clientName: 'Acme Corporation',
            question: 'What is the tax impact of opening a second office location?',
            outcome: 'Analysis in progress...',
            status: 'processing',
            createdAt: '2025-01-15',
          },
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(firmApiUrl('/scenarios'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: form.clientId,
          question: form.question,
        }),
      });
      if (res.ok) {
        const newScenario = await res.json();
        setScenarios((prev) => [newScenario, ...prev]);
      }
    } catch {
      // Add optimistic scenario
      const selectedClient = clients.find((c) => c.id === form.clientId);
      setScenarios((prev) => [
        {
          id: String(Date.now()),
          clientName: selectedClient?.name || 'Unknown Client',
          question: form.question,
          outcome: 'Analysis in progress...',
          status: 'processing',
          createdAt: new Date().toISOString().split('T')[0],
        },
        ...prev,
      ]);
    } finally {
      setSubmitting(false);
      setShowForm(false);
      setForm({ clientId: '', question: '' });
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <span className="badge-green">Completed</span>;
      case 'processing': return <span className="badge-yellow">Processing</span>;
      case 'failed': return <span className="badge-red">Failed</span>;
      default: return <span className="badge-blue">{status}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advisory</h1>
          <p className="text-gray-500 text-sm mt-1">AI-powered tax and business advisory scenarios</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Run New Scenario
        </button>
      </div>

      {/* New Scenario Form */}
      {showForm && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">New Advisory Scenario</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <select
                className="input"
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                required
              >
                <option value="">Select a client...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question / Scenario</label>
              <textarea
                className="input min-h-[100px] resize-y"
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="E.g., What if we convert from C-Corp to S-Corp? What are the tax implications of hiring 10 more employees?"
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Run Scenario'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Scenarios List */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Scenarios</h3>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="skeleton h-4 w-48" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-3/4" />
            </div>
          ))
        ) : scenarios.length > 0 ? (
          scenarios.map((scenario) => (
            <div key={scenario.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-brand-600">{scenario.clientName}</span>
                    {statusBadge(scenario.status)}
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-1">{scenario.question}</p>
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">{scenario.outcome}</p>
                  <p className="text-xs text-gray-400 mt-3">{scenario.createdAt}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="card p-8 text-center">
            <p className="text-gray-500 text-sm">No scenarios yet. Run your first advisory scenario above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
