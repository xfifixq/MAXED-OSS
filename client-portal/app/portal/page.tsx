'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const FIRM_NAME = 'MAXED Financial';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface DashboardData {
  outstandingInvoices: number;
  pendingDocuments: number;
  recentMessages: number;
}

export default function PortalHomePage() {
  const [clientName, setClientName] = useState('');
  const [data, setData] = useState<DashboardData>({
    outstandingInvoices: 0,
    pendingDocuments: 0,
    recentMessages: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const name = localStorage.getItem('clientName') || 'Valued Client';
    setClientName(name);

    const clientId = localStorage.getItem('clientId');
    if (!clientId) return;

    async function fetchDashboard() {
      try {
        const res = await fetch(`${API_URL}/api/clients/${clientId}/dashboard`);
        if (res.ok) {
          const json = await res.json();
          setData({
            outstandingInvoices: json.outstandingInvoices ?? 0,
            pendingDocuments: json.pendingDocuments ?? 0,
            recentMessages: json.recentMessages ?? 0,
          });
        }
      } catch {
        // Use defaults if API is unavailable
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="page-title">
          Hi {clientName}, here&apos;s your financial overview
        </h1>
        <p className="mt-2 text-gray-500 text-lg">
          Welcome to your {FIRM_NAME} client portal.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <SummaryCard
          label="Outstanding Invoices"
          value={loading ? '--' : String(data.outstandingInvoices)}
          href="/portal/invoices"
          color="blue"
        />
        <SummaryCard
          label="Documents Pending Review"
          value={loading ? '--' : String(data.pendingDocuments)}
          href="/portal/documents"
          color="amber"
        />
        <SummaryCard
          label="Recent Messages"
          value={loading ? '--' : String(data.recentMessages)}
          href="/portal/messages"
          color="green"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="section-label mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickAction
            href="/portal/documents"
            label="Upload Document"
            description="Send a document to your accounting team"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            }
          />
          <QuickAction
            href="/portal/invoices"
            label="View Invoices"
            description="Check and pay your outstanding invoices"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <QuickAction
            href="/portal/ask"
            label="Ask a Question"
            description="Send a financial question to your team"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  href,
  color,
}: {
  label: string;
  value: string;
  href: string;
  color: 'blue' | 'amber' | 'green';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    green: 'bg-green-50 text-green-700 border-green-100',
  };

  return (
    <Link href={href} className={`card hover:shadow-md transition-shadow ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-4xl font-bold mt-2">{value}</p>
    </Link>
  );
}

function QuickAction({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="card flex items-start gap-4 hover:shadow-md hover:border-brand-200 transition-all group"
    >
      <div className="flex-shrink-0 w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center group-hover:bg-brand-100 transition-colors">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-gray-900">{label}</p>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
    </Link>
  );
}
