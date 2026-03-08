'use client';

import Link from 'next/link';

const DOCUSEAL_URL = process.env.NEXT_PUBLIC_DOCUSEAL_URL || 'http://localhost:3003';

export default function ProposalsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Back to Dashboard"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Proposals</h1>
            <p className="text-gray-500 text-sm mt-1">Create and manage engagement proposals with DocuSeal</p>
          </div>
        </div>
        <a
          href={DOCUSEAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Proposal
        </a>
      </div>

      <div className="iframe-container">
        <iframe
          src={DOCUSEAL_URL}
          title="DocuSeal - Document Signing &amp; Proposals"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
