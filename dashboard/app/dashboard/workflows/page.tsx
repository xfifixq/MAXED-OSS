'use client';

const N8N_URL = process.env.NEXT_PUBLIC_N8N_URL || 'http://localhost:5678';

export default function WorkflowsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <p className="text-gray-500 text-sm mt-1">Automate firm processes with n8n workflows</p>
        </div>
        <a
          href={N8N_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open n8n
        </a>
      </div>

      <div className="iframe-container">
        <iframe
          src={N8N_URL}
          title="n8n Workflow Automation"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
