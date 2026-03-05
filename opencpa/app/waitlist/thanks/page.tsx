import Link from 'next/link';

export default function ThanksPage() {
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

      <main className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-10 w-10 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            You&apos;re on the list!
          </h1>

          <p className="mt-4 text-lg leading-relaxed text-gray-600">
            Thanks for joining the OpenCPA waitlist. We&apos;ll notify you when new
            tools, migration guides, and cost-saving strategies are available for
            your firm.
          </p>

          <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
            <h3 className="font-semibold text-gray-900">While you wait:</h3>
            <ul className="mt-3 space-y-2 text-left text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Browse our{' '}
                <Link href="/directory" className="font-medium text-brand-600 hover:text-brand-700">
                  CPA Tool Directory
                </Link>{' '}
                to see all open-source alternatives
              </li>
              <li className="flex items-start gap-2">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Generate a{' '}
                <Link href="/report" className="font-medium text-brand-600 hover:text-brand-700">
                  Cost Savings Report
                </Link>{' '}
                for your specific firm
              </li>
              <li className="flex items-start gap-2">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Share OpenCPA with a colleague who&apos;s tired of overpaying for
                software
              </li>
            </ul>
          </div>

          <div className="mt-8">
            <Link href="/" className="btn-primary">
              Back to Home
            </Link>
          </div>
        </div>
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
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} OpenCPA. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
