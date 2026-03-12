'use client';

import Link from 'next/link';

export default function AdvisoryPage() {
  return (
    <div className="max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Link
        href="/dashboard"
        className="self-start mb-8 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        title="Back to Dashboard"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </Link>

      <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Coming Soon
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-3">AI-Powered Advisory</h1>

      <p className="text-gray-600 leading-relaxed max-w-xl">
        Automate your forward-looking advisory with thousands of AI-driven simulations
        that factor in macroeconomic context, tax law changes, and client-specific
        financial data. Run &quot;what-if&quot; scenarios in seconds&mdash;from entity restructuring
        and R&amp;D credit eligibility to cash flow forecasting under different economic
        conditions&mdash;and deliver proactive, data-backed recommendations to your clients.
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg">
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-2xl font-bold text-brand-600">1000s</p>
          <p className="text-xs text-gray-500 mt-1">AI Simulations</p>
        </div>
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-2xl font-bold text-brand-600">Real-time</p>
          <p className="text-xs text-gray-500 mt-1">Macro Context</p>
        </div>
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-2xl font-bold text-brand-600">Instant</p>
          <p className="text-xs text-gray-500 mt-1">What-if Scenarios</p>
        </div>
      </div>
    </div>
  );
}
