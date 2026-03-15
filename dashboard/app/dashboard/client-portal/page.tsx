const PORTAL_URL = process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || 'https://portal.maxed.life';

export default function ClientPortalPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
        <p className="text-sm text-gray-500 mt-1">
          The firm-facing portal for secure document exchange, invoices, proposals, and messaging.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Open Portal</h2>
          <p className="mt-2 text-sm text-gray-500">
            Launch the live client portal in a separate tab.
          </p>
          <a
            href={PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-4 inline-flex"
          >
            Open Client Portal
          </a>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Portal Capabilities</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>Secure document upload and retrieval</li>
            <li>Invoice review and payment status</li>
            <li>Proposal review and signature flow</li>
            <li>Client messaging and questions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
