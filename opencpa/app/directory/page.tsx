'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

interface Tool {
  category: string;
  commercial: string;
  annualCost: number | null;
  ossAlternative: string;
  altCost: string;
  savings: number | null;
  status: 'replaces' | 'integrate';
}

const tools: Tool[] = [
  { category: 'Practice Management', commercial: 'Karbon', annualCost: 10000, ossAlternative: 'Maxed Platform', altCost: '$3,588', savings: 6412, status: 'replaces' },
  { category: 'Practice Management', commercial: 'Canopy', annualCost: 6000, ossAlternative: 'Maxed Platform', altCost: '$3,588', savings: 2412, status: 'replaces' },
  { category: 'Practice Management', commercial: 'TaxDome', annualCost: 4800, ossAlternative: 'Maxed Platform', altCost: '$3,588', savings: 1212, status: 'replaces' },
  { category: 'Bookkeeping/GL', commercial: 'QuickBooks Online', annualCost: 8000, ossAlternative: 'Bigcapital', altCost: '$0', savings: 8000, status: 'replaces' },
  { category: 'Bookkeeping/GL', commercial: 'Accounting CS', annualCost: 4000, ossAlternative: 'Bigcapital', altCost: '$0', savings: 4000, status: 'replaces' },
  { category: 'Document Management', commercial: 'File Cabinet CS', annualCost: 2000, ossAlternative: 'Paperless-ngx', altCost: '$0', savings: 2000, status: 'replaces' },
  { category: 'Document Management', commercial: 'SmartVault', annualCost: 2700, ossAlternative: 'Paperless-ngx', altCost: '$0', savings: 2700, status: 'replaces' },
  { category: 'BI / Reporting', commercial: 'Fathom', annualCost: 5000, ossAlternative: 'Metabase', altCost: '$0', savings: 5000, status: 'replaces' },
  { category: 'BI / Reporting', commercial: 'Jirav', annualCost: 2400, ossAlternative: 'Metabase', altCost: '$0', savings: 2400, status: 'replaces' },
  { category: 'Proposals', commercial: 'Ignition', annualCost: 4000, ossAlternative: 'DocuSeal', altCost: '$0', savings: 4000, status: 'replaces' },
  { category: 'Proposals', commercial: 'GoProposal', annualCost: 3180, ossAlternative: 'DocuSeal', altCost: '$0', savings: 3180, status: 'replaces' },
  { category: 'E-Signatures', commercial: 'Adobe Acrobat', annualCost: 2000, ossAlternative: 'DocuSeal', altCost: '$0', savings: 2000, status: 'replaces' },
  { category: 'E-Signatures', commercial: 'DocuSign', annualCost: 1500, ossAlternative: 'DocuSeal', altCost: '$0', savings: 1500, status: 'replaces' },
  { category: 'Advisory', commercial: 'Valuebuilder', annualCost: 9000, ossAlternative: 'Maxed AI Advisory', altCost: 'Included', savings: 9000, status: 'replaces' },
  { category: 'Workflow Automation', commercial: 'Zapier', annualCost: 2400, ossAlternative: 'n8n', altCost: '$0', savings: 2400, status: 'replaces' },
  { category: 'CRM', commercial: 'HubSpot Starter', annualCost: 2400, ossAlternative: 'Twenty CRM', altCost: '$0', savings: 2400, status: 'replaces' },
  { category: 'Team Communication', commercial: 'Slack Pro', annualCost: 1260, ossAlternative: 'Mattermost', altCost: '$0', savings: 1260, status: 'replaces' },
  { category: 'Time Tracking', commercial: 'Harvest', annualCost: 660, ossAlternative: 'Kimai', altCost: '$0', savings: 660, status: 'replaces' },
  { category: 'Invoicing', commercial: 'Bill.com', annualCost: 2400, ossAlternative: 'Invoice Ninja', altCost: '$0', savings: 2400, status: 'replaces' },
  { category: 'Tax Prep', commercial: 'UltraTax CS', annualCost: 20000, ossAlternative: 'Integrate only', altCost: '\u2014', savings: null, status: 'integrate' },
  { category: 'Tax Prep', commercial: 'ProConnect', annualCost: 5500, ossAlternative: 'Integrate only', altCost: '\u2014', savings: null, status: 'integrate' },
  { category: 'Tax Prep', commercial: 'Lacerte', annualCost: 5000, ossAlternative: 'Integrate only', altCost: '\u2014', savings: null, status: 'integrate' },
  { category: 'Payroll', commercial: 'Gusto', annualCost: 3600, ossAlternative: 'Integrate only', altCost: '\u2014', savings: null, status: 'integrate' },
];

const categories = ['All Categories', ...Array.from(new Set(tools.map((t) => t.category)))];

function formatCurrency(amount: number | null): string {
  if (amount === null) return '\u2014';
  return '$' + amount.toLocaleString('en-US');
}

export default function DirectoryPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');

  const filtered = useMemo(() => {
    return tools.filter((tool) => {
      const matchesCategory =
        categoryFilter === 'All Categories' || tool.category === categoryFilter;
      const matchesSearch =
        !search ||
        tool.commercial.toLowerCase().includes(search.toLowerCase()) ||
        tool.ossAlternative.toLowerCase().includes(search.toLowerCase()) ||
        tool.category.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [search, categoryFilter]);

  const totalCommercialCost = filtered.reduce((sum, t) => sum + (t.annualCost || 0), 0);
  const totalSavings = filtered.reduce((sum, t) => sum + (t.savings || 0), 0);
  const replaceableCount = filtered.filter((t) => t.status === 'replaces').length;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
              <span className="text-lg font-bold text-white">O</span>
            </div>
            <span className="text-xl font-bold text-gray-900">OpenCPA</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/directory"
              className="text-sm font-medium text-brand-600"
            >
              Tool Directory
            </Link>
            <Link href="/report" className="btn-primary !px-4 !py-2 !text-sm">
              Free Report
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* Header */}
        <section className="border-b border-gray-100 bg-gradient-to-b from-brand-50/60 to-white py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
                CPA Software Tool Directory
              </h1>
              <p className="mt-4 text-lg text-gray-600">
                Every major CPA software tool mapped to an open-source alternative.
                Search, filter, and see exactly how much you can save.
              </p>
            </div>

            {/* Summary Stats */}
            <div className="mx-auto mt-8 grid max-w-3xl grid-cols-3 gap-4">
              <div className="rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-gray-100">
                <p className="text-2xl font-bold text-gray-900 sm:text-3xl">{filtered.length}</p>
                <p className="mt-1 text-xs font-medium text-gray-500 sm:text-sm">Tools Listed</p>
              </div>
              <div className="rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-gray-100">
                <p className="text-2xl font-bold text-emerald-600 sm:text-3xl">{replaceableCount}</p>
                <p className="mt-1 text-xs font-medium text-gray-500 sm:text-sm">OSS Replacements</p>
              </div>
              <div className="rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-gray-100">
                <p className="text-2xl font-bold text-brand-600 sm:text-3xl">{formatCurrency(totalSavings)}</p>
                <p className="mt-1 text-xs font-medium text-gray-500 sm:text-sm">Max Annual Savings</p>
              </div>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="border-b border-gray-100 bg-white py-4">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search tools, categories, or alternatives..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field !py-2.5 !pl-10"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input-field !w-auto !py-2.5 sm:max-w-[220px]"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Table */}
        <section className="py-6 sm:py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* Desktop Table */}
            <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Commercial Tool
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Annual Cost
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      OSS Alternative
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Alt Cost
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Savings
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((tool, i) => (
                    <tr
                      key={`${tool.commercial}-${i}`}
                      className="transition-colors hover:bg-gray-50/50"
                    >
                      <td className="px-4 py-3.5 text-sm text-gray-500">
                        {tool.category}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-medium text-gray-900">
                        {tool.commercial}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(tool.annualCost)}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-medium text-brand-600">
                        {tool.ossAlternative}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-600">
                        {tool.altCost}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-semibold text-emerald-600">
                        {tool.savings !== null ? formatCurrency(tool.savings) : '\u2014'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {tool.status === 'replaces' ? (
                          <span className="badge-green">Replaces</span>
                        ) : (
                          <span className="badge-blue">Integrate</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {filtered.map((tool, i) => (
                <div
                  key={`mobile-${tool.commercial}-${i}`}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500">{tool.category}</p>
                      <p className="mt-0.5 font-semibold text-gray-900">{tool.commercial}</p>
                    </div>
                    {tool.status === 'replaces' ? (
                      <span className="badge-green">Replaces</span>
                    ) : (
                      <span className="badge-blue">Integrate</span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-center">
                    <div>
                      <p className="text-xs text-gray-500">Cost</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(tool.annualCost)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Alternative</p>
                      <p className="text-sm font-medium text-brand-600">{tool.ossAlternative}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Savings</p>
                      <p className="text-sm font-bold text-emerald-600">
                        {tool.savings !== null ? formatCurrency(tool.savings) : '\u2014'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-lg text-gray-500">No tools found matching your search.</p>
                <button
                  onClick={() => {
                    setSearch('');
                    setCategoryFilter('All Categories');
                  }}
                  className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Note about Tax Prep / Payroll */}
            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 p-5">
              <div className="flex gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="font-semibold text-blue-900">
                    About Tax Prep &amp; Payroll
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-blue-800">
                    Tax preparation and payroll software have no viable open-source
                    replacements due to regulatory compliance requirements, tax code
                    updates, and e-filing integrations. These tools are marked as
                    &ldquo;Integrate&rdquo; &mdash; meaning we connect with them via API
                    rather than replacing them. Your existing tax prep and payroll
                    subscriptions remain as-is.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-8 text-center">
              <p className="text-gray-600">
                Want to see exactly how much your firm can save?
              </p>
              <Link href="/report" className="btn-primary mt-4 !px-8 !py-3">
                Get Your Free Cost Savings Report
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-900 py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600">
              <span className="text-sm font-bold text-white">O</span>
            </div>
            <span className="font-semibold">OpenCPA</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-300">Home</Link>
            <Link href="/directory" className="hover:text-gray-300">Directory</Link>
            <Link href="/report" className="hover:text-gray-300">Cost Report</Link>
          </div>
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} OpenCPA. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
