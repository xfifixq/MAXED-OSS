'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const existing = JSON.parse(localStorage.getItem('opencpa_waitlist') || '[]');
    existing.push({ email, date: new Date().toISOString() });
    localStorage.setItem('opencpa_waitlist', JSON.stringify(existing));
    setSubmitted(true);
    setEmail('');
  };

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

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/50 to-white" />
        <div className="absolute inset-y-0 right-0 -z-10 w-1/2 bg-gradient-to-l from-brand-50/30 to-transparent" />

        <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            {/* Trust Signal */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Join 50+ CPA firms already cutting their software costs
            </div>

            <h1 className="text-balance text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              See how much your firm spends on software{' '}
              <span className="gradient-text">(and how to cut it by 50-80%)</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-gray-600 sm:text-xl">
              CPA firms spend{' '}
              <strong className="text-gray-900">$20,000 - $76,000/year</strong> on
              fragmented software. We mapped every tool to a free open-source
              alternative.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/report" className="btn-primary !px-8 !py-4 !text-lg">
                Get Your Free Cost Savings Report
                <svg
                  className="ml-2 h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
              <Link href="/directory" className="btn-secondary !px-8 !py-4 !text-lg">
                Browse the CPA Tool Directory
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="border-y border-gray-100 bg-gray-50/50 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="card text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">23 Tools Mapped</h3>
              <p className="mt-2 text-sm text-gray-600">
                Every major CPA software tool matched to an open-source replacement or
                integration path.
              </p>
            </div>
            <div className="card text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">$50K+ Savings</h3>
              <p className="mt-2 text-sm text-gray-600">
                Typical mid-size CPA firms save $50,000 or more per year by switching
                to open-source alternatives.
              </p>
            </div>
            <div className="card text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Instant Report</h3>
              <p className="mt-2 text-sm text-gray-600">
                Select the tools your firm uses and get a personalized cost savings
                report in under 2 minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="section-heading">How It Works</h2>
            <p className="section-subheading mx-auto max-w-2xl">
              Three steps to see exactly what your firm can save.
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Select Your Tools',
                desc: 'Check off the commercial software your firm currently uses.',
              },
              {
                step: '2',
                title: 'Get Your Report',
                desc: 'See a personalized breakdown of costs vs. open-source alternatives.',
              },
              {
                step: '3',
                title: 'Start Saving',
                desc: 'Download your report and begin migrating to save 50-80%.',
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link href="/report" className="btn-primary !px-8 !py-4 !text-lg">
              Get Your Free Cost Savings Report
            </Link>
          </div>
        </div>
      </section>

      {/* Footer / Waitlist */}
      <footer className="border-t border-gray-200 bg-gray-900 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Get early access to OpenCPA
            </h2>
            <p className="mt-3 text-gray-400">
              Join the waitlist and be the first to know when we launch new tools and
              migration guides.
            </p>

            {submitted ? (
              <div className="mt-8 rounded-lg bg-emerald-900/30 p-4 text-emerald-300">
                Thanks for joining! We&apos;ll be in touch soon.
              </div>
            ) : (
              <form
                onSubmit={handleWaitlist}
                className="mt-8 flex flex-col gap-3 sm:flex-row"
              >
                <input
                  type="email"
                  required
                  placeholder="you@yourfirm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field flex-1 !border-gray-700 !bg-gray-800 !text-white !placeholder-gray-500 focus:!border-brand-500"
                />
                <button type="submit" className="btn-primary whitespace-nowrap">
                  Join Waitlist
                </button>
              </form>
            )}
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-800 pt-8 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600">
                <span className="text-sm font-bold text-white">O</span>
              </div>
              <span className="font-semibold">OpenCPA</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <Link href="/directory" className="hover:text-gray-300">
                Directory
              </Link>
              <Link href="/report" className="hover:text-gray-300">
                Cost Report
              </Link>
            </div>
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} OpenCPA. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
