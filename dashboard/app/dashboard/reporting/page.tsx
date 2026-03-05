'use client';

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL || 'http://localhost:3002';

export default function ReportingPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporting</h1>
          <p className="text-gray-500 text-sm mt-1">Business intelligence and analytics dashboards</p>
        </div>
        <a
          href={METABASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open Metabase
        </a>
      </div>

      {/* Dashboard cards linking to specific Metabase dashboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-hover p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Revenue Overview</h3>
              <p className="text-xs text-gray-500">Monthly and quarterly revenue trends</p>
            </div>
          </div>
          <a
            href={`${METABASE_URL}/dashboard/1`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            View Dashboard &rarr;
          </a>
        </div>

        <div className="card-hover p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Client Analytics</h3>
              <p className="text-xs text-gray-500">Client distribution and engagement metrics</p>
            </div>
          </div>
          <a
            href={`${METABASE_URL}/dashboard/2`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            View Dashboard &rarr;
          </a>
        </div>

        <div className="card-hover p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Invoice Performance</h3>
              <p className="text-xs text-gray-500">Payment trends and outstanding balances</p>
            </div>
          </div>
          <a
            href={`${METABASE_URL}/dashboard/3`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            View Dashboard &rarr;
          </a>
        </div>

        <div className="card-hover p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Advisory Impact</h3>
              <p className="text-xs text-gray-500">Scenario outcomes and tax savings analysis</p>
            </div>
          </div>
          <a
            href={`${METABASE_URL}/dashboard/4`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            View Dashboard &rarr;
          </a>
        </div>
      </div>

      {/* Embedded Metabase */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Embedded Analytics</h3>
        <div className="iframe-container">
          <iframe
            src={METABASE_URL}
            title="Metabase Analytics"
            allow="fullscreen"
          />
        </div>
      </div>
    </div>
  );
}
