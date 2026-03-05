'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const DOCUSEAL_URL = process.env.NEXT_PUBLIC_DOCUSEAL_URL || 'http://localhost:3003';

interface Proposal {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  signUrl?: string;
  description?: string;
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProposals() {
      const clientId = localStorage.getItem('clientId');
      if (!clientId) return;

      try {
        const res = await fetch(`${API_URL}/api/clients/${clientId}/proposals`);
        if (res.ok) {
          const data = await res.json();
          setProposals(Array.isArray(data) ? data : data.proposals || []);
        }
      } catch {
        // API unavailable
      } finally {
        setLoading(false);
      }
    }

    fetchProposals();
  }, []);

  function getStatusBadge(status: string) {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Awaiting Signature' },
      signed: { bg: 'bg-green-50', text: 'text-green-700', label: 'Signed' },
      declined: { bg: 'bg-red-50', text: 'text-red-700', label: 'Declined' },
      expired: { bg: 'bg-gray-50', text: 'text-gray-600', label: 'Expired' },
      completed: { bg: 'bg-green-50', text: 'text-green-700', label: 'Completed' },
    };
    const s = statusMap[status] || statusMap.pending;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  }

  function getSignUrl(proposal: Proposal) {
    return proposal.signUrl || `${DOCUSEAL_URL}/s/${proposal.id}`;
  }

  const pendingProposals = proposals.filter(
    (p) => p.status === 'pending' || p.status === 'sent'
  );
  const completedProposals = proposals.filter(
    (p) => p.status !== 'pending' && p.status !== 'sent'
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="page-title">Proposals</h1>
        <p className="mt-1 text-gray-500">Review and sign proposals from your accounting team.</p>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-gray-400">Loading proposals...</div>
      ) : proposals.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="mx-auto w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-gray-500 text-lg mb-2">No proposals yet</p>
          <p className="text-gray-400 text-sm">Proposals from your accounting team will appear here.</p>
        </div>
      ) : (
        <>
          {/* Pending Proposals */}
          {pendingProposals.length > 0 && (
            <div>
              <h2 className="section-label mb-4">Awaiting Your Signature</h2>
              <div className="space-y-4">
                {pendingProposals.map((proposal) => (
                  <div key={proposal.id} className="card flex flex-col sm:flex-row sm:items-center gap-4 border-l-4 border-l-yellow-400">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-lg">{proposal.title}</p>
                      {proposal.description && (
                        <p className="text-sm text-gray-500 mt-1">{proposal.description}</p>
                      )}
                      <p className="text-sm text-gray-400 mt-2">
                        Sent: {new Date(proposal.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-shrink-0">
                      {getStatusBadge(proposal.status)}
                      <a
                        href={getSignUrl(proposal)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary whitespace-nowrap"
                      >
                        Review &amp; Sign
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Proposals */}
          {completedProposals.length > 0 && (
            <div>
              <h2 className="section-label mb-4">Completed</h2>
              <div className="card overflow-hidden p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Proposal</th>
                      <th className="text-left text-sm font-medium text-gray-500 px-6 py-4 hidden sm:table-cell">Date</th>
                      <th className="text-right text-sm font-medium text-gray-500 px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {completedProposals.map((proposal) => (
                      <tr key={proposal.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{proposal.title}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 hidden sm:table-cell">
                          {new Date(proposal.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">{getStatusBadge(proposal.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
