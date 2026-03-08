'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface ToolOption {
  category: string;
  commercial: string;
  annualCost: number;
  ossAlternative: string;
  altCostAnnual: number;
  replaceable: boolean;
}

const toolOptions: ToolOption[] = [
  { category: 'Practice Management', commercial: 'Karbon', annualCost: 10000, ossAlternative: 'Maxed Platform', altCostAnnual: 3588, replaceable: true },
  { category: 'Practice Management', commercial: 'Canopy', annualCost: 6000, ossAlternative: 'Maxed Platform', altCostAnnual: 3588, replaceable: true },
  { category: 'Practice Management', commercial: 'TaxDome', annualCost: 4800, ossAlternative: 'Maxed Platform', altCostAnnual: 3588, replaceable: true },
  { category: 'Bookkeeping/GL', commercial: 'QuickBooks Online', annualCost: 8000, ossAlternative: 'Bigcapital', altCostAnnual: 0, replaceable: true },
  { category: 'Bookkeeping/GL', commercial: 'Accounting CS', annualCost: 4000, ossAlternative: 'Bigcapital', altCostAnnual: 0, replaceable: true },
  { category: 'Document Management', commercial: 'File Cabinet CS', annualCost: 2000, ossAlternative: 'Paperless-ngx', altCostAnnual: 0, replaceable: true },
  { category: 'Document Management', commercial: 'SmartVault', annualCost: 2700, ossAlternative: 'Paperless-ngx', altCostAnnual: 0, replaceable: true },
  { category: 'BI / Reporting', commercial: 'Fathom', annualCost: 5000, ossAlternative: 'Metabase', altCostAnnual: 0, replaceable: true },
  { category: 'BI / Reporting', commercial: 'Jirav', annualCost: 2400, ossAlternative: 'Metabase', altCostAnnual: 0, replaceable: true },
  { category: 'Proposals', commercial: 'Ignition', annualCost: 4000, ossAlternative: 'DocuSeal', altCostAnnual: 0, replaceable: true },
  { category: 'Proposals', commercial: 'GoProposal', annualCost: 3180, ossAlternative: 'DocuSeal', altCostAnnual: 0, replaceable: true },
  { category: 'E-Signatures', commercial: 'Adobe Acrobat', annualCost: 2000, ossAlternative: 'DocuSeal', altCostAnnual: 0, replaceable: true },
  { category: 'E-Signatures', commercial: 'DocuSign', annualCost: 1500, ossAlternative: 'DocuSeal', altCostAnnual: 0, replaceable: true },
  { category: 'Advisory', commercial: 'Valuebuilder', annualCost: 9000, ossAlternative: 'Maxed AI Advisory', altCostAnnual: 0, replaceable: true },
  { category: 'Workflow Automation', commercial: 'Zapier', annualCost: 2400, ossAlternative: 'n8n', altCostAnnual: 0, replaceable: true },
  { category: 'CRM', commercial: 'HubSpot Starter', annualCost: 2400, ossAlternative: 'Twenty CRM', altCostAnnual: 0, replaceable: true },
  { category: 'Team Communication', commercial: 'Slack Pro', annualCost: 1260, ossAlternative: 'Mattermost', altCostAnnual: 0, replaceable: true },
  { category: 'Time Tracking', commercial: 'Harvest', annualCost: 660, ossAlternative: 'Kimai', altCostAnnual: 0, replaceable: true },
  { category: 'Invoicing', commercial: 'Bill.com', annualCost: 2400, ossAlternative: 'Invoice Ninja', altCostAnnual: 0, replaceable: true },
  { category: 'Tax Prep', commercial: 'UltraTax CS', annualCost: 20000, ossAlternative: 'Integrate only', altCostAnnual: 0, replaceable: false },
  { category: 'Tax Prep', commercial: 'ProConnect', annualCost: 5500, ossAlternative: 'Integrate only', altCostAnnual: 0, replaceable: false },
  { category: 'Tax Prep', commercial: 'Lacerte', annualCost: 5000, ossAlternative: 'Integrate only', altCostAnnual: 0, replaceable: false },
  { category: 'Payroll', commercial: 'Gusto', annualCost: 3600, ossAlternative: 'Integrate only', altCostAnnual: 0, replaceable: false },
];

const groupedTools = toolOptions.reduce<Record<string, ToolOption[]>>((acc, tool) => {
  if (!acc[tool.category]) acc[tool.category] = [];
  acc[tool.category].push(tool);
  return acc;
}, {});

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US');
}

function getMaxedPlatformCost(users: number): number {
  if (users <= 3) return 299 * 12;
  if (users <= 8) return 799 * 12;
  return 1999 * 12;
}

function getMaxedTier(users: number): string {
  if (users <= 3) return 'Starter (1-3 users) \u2014 $299/mo';
  if (users <= 8) return 'Growth (4-8 users) \u2014 $799/mo';
  return 'Enterprise (9+ users) \u2014 $1,999/mo';
}

export default function ReportPage() {
  const [step, setStep] = useState(1);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [userCount, setUserCount] = useState(5);
  const [email, setEmail] = useState('');
  const [showResults, setShowResults] = useState(false);

  const toggleTool = (commercial: string) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(commercial)) {
        next.delete(commercial);
      } else {
        next.add(commercial);
      }
      return next;
    });
  };

  const selectAll = (category: string) => {
    const catTools = groupedTools[category];
    const allSelected = catTools.every((t) => selectedTools.has(t.commercial));
    setSelectedTools((prev) => {
      const next = new Set(prev);
      catTools.forEach((t) => {
        if (allSelected) {
          next.delete(t.commercial);
        } else {
          next.add(t.commercial);
        }
      });
      return next;
    });
  };

  const selected = useMemo(
    () => toolOptions.filter((t) => selectedTools.has(t.commercial)),
    [selectedTools]
  );

  const replaceableSelected = useMemo(
    () => selected.filter((t) => t.replaceable),
    [selected]
  );

  const totalCurrentSpend = selected.reduce((sum, t) => sum + t.annualCost, 0);
  const maxedCost = getMaxedPlatformCost(userCount);
  const nonReplaceableCost = selected
    .filter((t) => !t.replaceable)
    .reduce((sum, t) => sum + t.annualCost, 0);
  const newTotalCost = maxedCost + nonReplaceableCost;
  const totalSavings = totalCurrentSpend - newTotalCost;
  const savingsPercent =
    totalCurrentSpend > 0
      ? Math.round((totalSavings / totalCurrentSpend) * 100)
      : 0;

  const handleSubmit = () => {
    if (email) {
      const existing = JSON.parse(
        localStorage.getItem('opencpa_waitlist') || '[]'
      );
      existing.push({
        email,
        tools: Array.from(selectedTools),
        users: userCount,
        savings: totalSavings,
        date: new Date().toISOString(),
      });
      localStorage.setItem('opencpa_waitlist', JSON.stringify(existing));
    }
    setShowResults(true);
  };

  const downloadPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229);
    doc.text('OpenCPA Cost Savings Report', pageWidth / 2, 25, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated ${new Date().toLocaleDateString()} | ${userCount} users`, pageWidth / 2, 34, { align: 'center' });

    doc.setDrawColor(229, 231, 235);
    doc.line(20, 40, pageWidth - 20, 40);

    // Summary box
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(20, 45, pageWidth - 40, 30, 3, 3, 'F');
    doc.setFontSize(14);
    doc.setTextColor(22, 101, 52);
    doc.text(`Annual Savings: ${formatCurrency(totalSavings)}`, pageWidth / 2, 57, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`${savingsPercent}% reduction | ${formatCurrency(totalCurrentSpend)} current \u2192 ${formatCurrency(newTotalCost)} with Maxed`, pageWidth / 2, 66, { align: 'center' });

    // Table header
    let y = 88;
    doc.setFillColor(249, 250, 251);
    doc.rect(20, y - 5, pageWidth - 40, 10, 'F');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('TOOL', 22, y + 1);
    doc.text('CURRENT COST', 85, y + 1);
    doc.text('REPLACEMENT', 120, y + 1);
    doc.text('NEW COST', 158, y + 1);
    doc.text('SAVINGS', 182, y + 1);

    y += 12;
    doc.setFontSize(9);

    selected.forEach((tool) => {
      if (y > 270) {
        doc.addPage();
        y = 25;
      }
      doc.setTextColor(17, 24, 39);
      doc.text(tool.commercial, 22, y);
      doc.text(formatCurrency(tool.annualCost), 85, y);
      doc.setTextColor(79, 70, 229);
      doc.text(tool.ossAlternative, 120, y);
      doc.setTextColor(17, 24, 39);
      doc.text(tool.replaceable ? formatCurrency(tool.altCostAnnual) : 'Kept', 158, y);
      doc.setTextColor(22, 101, 52);
      doc.text(
        tool.replaceable ? formatCurrency(tool.annualCost - tool.altCostAnnual) : '\u2014',
        182,
        y
      );
      y += 8;
    });

    y += 5;
    doc.setDrawColor(229, 231, 235);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Maxed Platform: ${getMaxedTier(userCount)} = ${formatCurrency(maxedCost)}/yr`, 22, y);

    y += 15;
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.text('Ready to start saving? Visit opencpa.io or email hello@opencpa.io', pageWidth / 2, y, { align: 'center' });

    doc.save('OpenCPA-Cost-Savings-Report.pdf');
  };

  const maxBarValue = Math.max(totalCurrentSpend, newTotalCost, 1);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden bg-[#0a0a0a]">
              <Image src="/maxed_acc_logo.png" alt="Maxed" width={36} height={36} className="object-contain p-0.5" />
            </div>
            <span className="text-xl font-bold text-gray-900">OpenCPA</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/directory"
              className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-600"
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
        {!showResults ? (
          <>
            {/* Header */}
            <section className="border-b border-gray-100 bg-gradient-to-b from-brand-50/60 to-white py-10 sm:py-14">
              <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                  Your Free Cost Savings Report
                </h1>
                <p className="mt-3 text-lg text-gray-600">
                  Select the tools your firm uses, and we&apos;ll calculate exactly how
                  much you can save by switching to open-source alternatives.
                </p>

                {/* Progress Steps */}
                <div className="mx-auto mt-8 flex max-w-md items-center justify-center">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center">
                      <button
                        onClick={() => {
                          if (s < step) setStep(s);
                        }}
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                          s === step
                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-200'
                            : s < step
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {s < step ? (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          s
                        )}
                      </button>
                      {s < 3 && (
                        <div
                          className={`mx-2 h-1 w-16 rounded-full sm:w-24 ${
                            s < step ? 'bg-emerald-500' : 'bg-gray-200'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mx-auto mt-2 flex max-w-md justify-between text-xs text-gray-500">
                  <span>Select Tools</span>
                  <span>Team Size</span>
                  <span>Get Report</span>
                </div>
              </div>
            </section>

            {/* Step Content */}
            <section className="py-8 sm:py-10">
              <div className="mx-auto max-w-3xl px-4 sm:px-6">
                {/* Step 1: Tool Selection */}
                {step === 1 && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Which tools does your firm currently use?
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Select all that apply. We&apos;ll calculate savings for each one.
                    </p>

                    <div className="mt-6 space-y-6">
                      {Object.entries(groupedTools).map(([category, catTools]) => {
                        const allChecked = catTools.every((t) =>
                          selectedTools.has(t.commercial)
                        );
                        const someChecked = catTools.some((t) =>
                          selectedTools.has(t.commercial)
                        );
                        return (
                          <div
                            key={category}
                            className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                          >
                            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={allChecked}
                                  ref={(el) => {
                                    if (el) el.indeterminate = someChecked && !allChecked;
                                  }}
                                  onChange={() => selectAll(category)}
                                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                />
                                <span className="text-sm font-semibold text-gray-700">
                                  {category}
                                </span>
                              </div>
                              {!catTools[0].replaceable && (
                                <span className="badge-blue">Integration only</span>
                              )}
                            </div>
                            <div className="divide-y divide-gray-50 px-4">
                              {catTools.map((tool) => (
                                <label
                                  key={tool.commercial}
                                  className="flex cursor-pointer items-center justify-between py-3 transition-colors hover:bg-gray-50"
                                >
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedTools.has(tool.commercial)}
                                      onChange={() => toggleTool(tool.commercial)}
                                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                    />
                                    <span className="text-sm text-gray-800">
                                      {tool.commercial}
                                    </span>
                                  </div>
                                  <span className="text-sm font-medium text-gray-500">
                                    {formatCurrency(tool.annualCost)}/yr
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-8 flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        {selectedTools.size} tool{selectedTools.size !== 1 ? 's' : ''} selected
                        {selectedTools.size > 0 && (
                          <span className="ml-1 font-medium text-gray-700">
                            ({formatCurrency(totalCurrentSpend)}/yr)
                          </span>
                        )}
                      </p>
                      <button
                        onClick={() => setStep(2)}
                        disabled={selectedTools.size === 0}
                        className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next: Team Size
                        <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Team Size */}
                {step === 2 && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      How many users does your firm have?
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      This determines your Maxed Platform pricing tier.
                    </p>

                    <div className="mx-auto mt-8 max-w-md">
                      <div className="rounded-xl border border-gray-200 bg-white p-6">
                        <label className="block text-sm font-medium text-gray-700">
                          Number of users
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={userCount}
                          onChange={(e) =>
                            setUserCount(
                              Math.max(1, Math.min(50, parseInt(e.target.value) || 1))
                            )
                          }
                          className="input-field mt-2 text-center text-2xl font-bold"
                        />

                        <div className="mt-6 space-y-3">
                          {[
                            { range: '1-3 users', price: '$299/mo', annual: '$3,588/yr', active: userCount >= 1 && userCount <= 3 },
                            { range: '4-8 users', price: '$799/mo', annual: '$9,588/yr', active: userCount >= 4 && userCount <= 8 },
                            { range: '9+ users', price: '$1,999/mo', annual: '$23,988/yr', active: userCount >= 9 },
                          ].map((tier) => (
                            <div
                              key={tier.range}
                              className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                                tier.active
                                  ? 'border-brand-300 bg-brand-50'
                                  : 'border-gray-100 bg-gray-50'
                              }`}
                            >
                              <div>
                                <p
                                  className={`text-sm font-semibold ${
                                    tier.active ? 'text-brand-700' : 'text-gray-600'
                                  }`}
                                >
                                  {tier.range}
                                </p>
                                <p className="text-xs text-gray-500">{tier.annual}</p>
                              </div>
                              <p
                                className={`text-lg font-bold ${
                                  tier.active ? 'text-brand-600' : 'text-gray-400'
                                }`}
                              >
                                {tier.price}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 flex items-center justify-between">
                      <button
                        onClick={() => setStep(1)}
                        className="text-sm font-medium text-gray-600 hover:text-gray-800"
                      >
                        &larr; Back
                      </button>
                      <button onClick={() => setStep(3)} className="btn-primary">
                        Next: Get Report
                        <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Email + Submit */}
                {step === 3 && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Where should we send your report?
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Enter your email to receive your personalized cost savings report.
                    </p>

                    <div className="mx-auto mt-8 max-w-md">
                      <div className="rounded-xl border border-gray-200 bg-white p-6">
                        {/* Summary */}
                        <div className="mb-6 rounded-lg bg-gray-50 p-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Tools selected</span>
                            <span className="font-medium text-gray-900">
                              {selectedTools.size}
                            </span>
                          </div>
                          <div className="mt-2 flex justify-between text-sm">
                            <span className="text-gray-500">Current annual spend</span>
                            <span className="font-medium text-gray-900">
                              {formatCurrency(totalCurrentSpend)}
                            </span>
                          </div>
                          <div className="mt-2 flex justify-between text-sm">
                            <span className="text-gray-500">Team size</span>
                            <span className="font-medium text-gray-900">
                              {userCount} user{userCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="mt-3 border-t border-gray-200 pt-3">
                            <div className="flex justify-between">
                              <span className="font-medium text-gray-700">
                                Estimated savings
                              </span>
                              <span className="text-lg font-bold text-emerald-600">
                                {formatCurrency(Math.max(totalSavings, 0))}
                              </span>
                            </div>
                          </div>
                        </div>

                        <label className="block text-sm font-medium text-gray-700">
                          Email address
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="you@yourfirm.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="input-field mt-2"
                        />

                        <button
                          onClick={handleSubmit}
                          disabled={!email}
                          className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Generate My Report
                        </button>

                        <p className="mt-3 text-center text-xs text-gray-400">
                          We&apos;ll never spam you. Unsubscribe anytime.
                        </p>
                      </div>
                    </div>

                    <div className="mt-8">
                      <button
                        onClick={() => setStep(2)}
                        className="text-sm font-medium text-gray-600 hover:text-gray-800"
                      >
                        &larr; Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          /* Results */
          <section className="py-10 sm:py-14">
            <div className="mx-auto max-w-4xl px-4 sm:px-6">
              {/* Big Savings Header */}
              <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-8 text-center text-white shadow-xl sm:p-12">
                <p className="text-sm font-medium uppercase tracking-wider text-emerald-100">
                  Your Estimated Annual Savings
                </p>
                <p className="mt-2 text-5xl font-extrabold sm:text-6xl lg:text-7xl">
                  {formatCurrency(Math.max(totalSavings, 0))}
                </p>
                <p className="mt-2 text-lg text-emerald-100">
                  {savingsPercent}% reduction in software costs
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm">
                  <div>
                    <p className="text-emerald-200">Current Spend</p>
                    <p className="text-xl font-bold">{formatCurrency(totalCurrentSpend)}/yr</p>
                  </div>
                  <div className="hidden h-12 w-px bg-emerald-400 sm:block" />
                  <div>
                    <p className="text-emerald-200">With Maxed</p>
                    <p className="text-xl font-bold">{formatCurrency(newTotalCost)}/yr</p>
                  </div>
                  <div className="hidden h-12 w-px bg-emerald-400 sm:block" />
                  <div>
                    <p className="text-emerald-200">Team Size</p>
                    <p className="text-xl font-bold">{userCount} users</p>
                  </div>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900">Cost Comparison</h3>
                <div className="mt-6 space-y-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">Current Software Stack</span>
                      <span className="font-bold text-gray-900">{formatCurrency(totalCurrentSpend)}/yr</span>
                    </div>
                    <div className="h-10 overflow-hidden rounded-lg bg-gray-100">
                      <div
                        className="flex h-full items-center rounded-lg bg-red-400 px-3 transition-all duration-700"
                        style={{ width: `${(totalCurrentSpend / maxBarValue) * 100}%` }}
                      >
                        <span className="text-xs font-semibold text-white">
                          {formatCurrency(totalCurrentSpend)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">With Maxed + Open Source</span>
                      <span className="font-bold text-emerald-600">{formatCurrency(newTotalCost)}/yr</span>
                    </div>
                    <div className="h-10 overflow-hidden rounded-lg bg-gray-100">
                      <div
                        className="flex h-full items-center rounded-lg bg-emerald-500 px-3 transition-all duration-700"
                        style={{ width: `${Math.max((newTotalCost / maxBarValue) * 100, 5)}%` }}
                      >
                        <span className="text-xs font-semibold text-white">
                          {formatCurrency(newTotalCost)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-center text-sm text-gray-500">
                  Maxed Platform tier: {getMaxedTier(userCount)} = {formatCurrency(maxedCost)}/yr
                </p>
              </div>

              {/* Breakdown Table */}
              <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                  <h3 className="text-lg font-bold text-gray-900">Detailed Breakdown</h3>
                </div>

                {/* Desktop */}
                <div className="hidden md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Current Tool
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Annual Cost
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Replacement
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                          New Cost
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Savings
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {selected.map((tool) => {
                        const saving = tool.replaceable
                          ? tool.annualCost - tool.altCostAnnual
                          : 0;
                        return (
                          <tr key={tool.commercial} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {tool.commercial}
                              <span className="ml-2 text-xs text-gray-400">
                                {tool.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-600">
                              {formatCurrency(tool.annualCost)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {tool.replaceable ? (
                                <span className="font-medium text-brand-600">
                                  {tool.ossAlternative}
                                </span>
                              ) : (
                                <span className="text-gray-400">Kept (integration)</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-600">
                              {tool.replaceable
                                ? formatCurrency(tool.altCostAnnual)
                                : formatCurrency(tool.annualCost)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-600">
                              {saving > 0 ? formatCurrency(saving) : '\u2014'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">
                          Total
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                          {formatCurrency(totalCurrentSpend)}
                        </td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                          {formatCurrency(newTotalCost)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-emerald-600">
                          {formatCurrency(Math.max(totalSavings, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile */}
                <div className="space-y-2 p-4 md:hidden">
                  {selected.map((tool) => {
                    const saving = tool.replaceable
                      ? tool.annualCost - tool.altCostAnnual
                      : 0;
                    return (
                      <div
                        key={tool.commercial}
                        className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{tool.commercial}</p>
                            <p className="text-xs text-gray-500">{tool.category}</p>
                          </div>
                          <p className="text-sm font-bold text-emerald-600">
                            {saving > 0 ? formatCurrency(saving) : '\u2014'}
                          </p>
                        </div>
                        <div className="mt-2 flex gap-4 text-xs">
                          <span className="text-gray-500">
                            Was: {formatCurrency(tool.annualCost)}
                          </span>
                          <span className="text-brand-600">
                            {tool.replaceable ? tool.ossAlternative : 'Kept'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CTAs */}
              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <button onClick={downloadPDF} className="btn-primary !px-8 !py-4">
                  <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF Report
                </button>
                <Link href="/waitlist/thanks" className="btn-secondary !px-8 !py-4">
                  Join the Waitlist
                </Link>
              </div>

              {/* Start Over */}
              <div className="mt-8 text-center">
                <button
                  onClick={() => {
                    setShowResults(false);
                    setStep(1);
                    setSelectedTools(new Set());
                    setEmail('');
                  }}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Start over with a new report
                </button>
              </div>
            </div>
          </section>
        )}
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
