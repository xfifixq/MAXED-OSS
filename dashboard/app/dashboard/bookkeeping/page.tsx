'use client';

import { useEffect, useState } from 'react';
import { apiUrl, serviceHeaders } from '@/lib/api';

interface Account {
  id: string | number;
  name: string;
  code: string;
  account_type: string;
  balance: number;
  description?: string;
}

interface Transaction {
  id: string | number;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  account?: string;
}

const TABS = ['Accounts', 'Transactions', 'Reports'] as const;
type Tab = typeof TABS[number];

const PLACEHOLDER_ACCOUNTS: Account[] = [
  { id: '1', name: 'Cash', code: '1000', account_type: 'asset', balance: 45200, description: 'Operating cash' },
  { id: '2', name: 'Accounts Receivable', code: '1100', account_type: 'asset', balance: 128500, description: 'Client receivables' },
  { id: '3', name: 'Office Equipment', code: '1500', account_type: 'asset', balance: 12000, description: 'Furniture & computers' },
  { id: '4', name: 'Accounts Payable', code: '2000', account_type: 'liability', balance: 18900, description: 'Vendor payables' },
  { id: '5', name: 'Unearned Revenue', code: '2100', account_type: 'liability', balance: 8500, description: 'Prepaid client fees' },
  { id: '6', name: "Owner's Equity", code: '3000', account_type: 'equity', balance: 100000, description: 'Capital contribution' },
  { id: '7', name: 'Retained Earnings', code: '3100', account_type: 'equity', balance: 42300, description: 'Accumulated profit' },
  { id: '8', name: 'Service Revenue', code: '4000', account_type: 'revenue', balance: 285000, description: 'Client services' },
  { id: '9', name: 'Consulting Revenue', code: '4100', account_type: 'revenue', balance: 45000, description: 'Advisory fees' },
  { id: '10', name: 'Salary Expense', code: '5000', account_type: 'expense', balance: 156000, description: 'Employee salaries' },
  { id: '11', name: 'Rent Expense', code: '5100', account_type: 'expense', balance: 36000, description: 'Office lease' },
  { id: '12', name: 'Software Expense', code: '5200', account_type: 'expense', balance: 8700, description: 'SaaS subscriptions' },
];

const PLACEHOLDER_TRANSACTIONS: Transaction[] = [
  { id: '1', date: '2026-03-12', reference: 'JE-0042', description: 'Client payment - Acme Corp', debit: 15000, credit: 0, account: 'Cash' },
  { id: '2', date: '2026-03-12', reference: 'JE-0042', description: 'Client payment - Acme Corp', debit: 0, credit: 15000, account: 'Accounts Receivable' },
  { id: '3', date: '2026-03-11', reference: 'JE-0041', description: 'Monthly rent payment', debit: 3000, credit: 0, account: 'Rent Expense' },
  { id: '4', date: '2026-03-11', reference: 'JE-0041', description: 'Monthly rent payment', debit: 0, credit: 3000, account: 'Cash' },
  { id: '5', date: '2026-03-10', reference: 'INV-1055', description: 'Tax prep services - TechStart', debit: 8500, credit: 0, account: 'Accounts Receivable' },
  { id: '6', date: '2026-03-10', reference: 'INV-1055', description: 'Tax prep services - TechStart', debit: 0, credit: 8500, account: 'Service Revenue' },
  { id: '7', date: '2026-03-08', reference: 'JE-0040', description: 'Software subscription renewal', debit: 299, credit: 0, account: 'Software Expense' },
  { id: '8', date: '2026-03-08', reference: 'JE-0040', description: 'Software subscription renewal', debit: 0, credit: 299, account: 'Cash' },
];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
  income: 'Revenue',
  cost_of_goods_sold: 'Cost of Goods Sold',
  other_income: 'Other Income',
  other_expense: 'Other Expenses',
};

export default function BookkeepingPage() {
  const [tab, setTab] = useState<Tab>('Accounts');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(apiUrl('/api/services/bigcapital/accounts'), { headers: serviceHeaders() });
        if (res.ok) {
          const data = await res.json();
          setAccounts(Array.isArray(data) ? data : data.accounts || data.results || PLACEHOLDER_ACCOUNTS);
        } else {
          setAccounts(PLACEHOLDER_ACCOUNTS);
        }
      } catch {
        setAccounts(PLACEHOLDER_ACCOUNTS);
      }

      try {
        const res = await fetch(apiUrl('/api/services/bigcapital/transactions'), { headers: serviceHeaders() });
        if (res.ok) {
          const data = await res.json();
          setTransactions(Array.isArray(data) ? data : data.results || PLACEHOLDER_TRANSACTIONS);
        } else {
          setTransactions(PLACEHOLDER_TRANSACTIONS);
        }
      } catch {
        setTransactions(PLACEHOLDER_TRANSACTIONS);
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  const groupedAccounts = accounts.reduce<Record<string, Account[]>>((groups, acc) => {
    const type = (acc.account_type || 'other').toLowerCase();
    const label = ACCOUNT_TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1);
    if (!groups[label]) groups[label] = [];
    groups[label].push(acc);
    return groups;
  }, {});

  const filteredTransactions = transactions.filter(
    (t) =>
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.reference.toLowerCase().includes(search.toLowerCase())
  );

  const totalAssets = accounts.filter(a => a.account_type?.toLowerCase() === 'asset').reduce((s, a) => s + (a.balance || 0), 0);
  const totalLiabilities = accounts.filter(a => a.account_type?.toLowerCase() === 'liability').reduce((s, a) => s + (a.balance || 0), 0);
  const totalRevenue = accounts.filter(a => ['revenue', 'income'].includes(a.account_type?.toLowerCase())).reduce((s, a) => s + (a.balance || 0), 0);
  const totalExpenses = accounts.filter(a => ['expense', 'cost_of_goods_sold', 'other_expense'].includes(a.account_type?.toLowerCase())).reduce((s, a) => s + (a.balance || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bookkeeping</h1>
        <p className="text-gray-500 text-sm mt-1">Chart of accounts and financial overview</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* Accounts Tab */}
      {tab === 'Accounts' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <p className="text-sm font-medium text-gray-500">Total Assets</p>
              {loading ? <div className="skeleton h-8 w-28 mt-1" /> : <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalAssets)}</p>}
            </div>
            <div className="stat-card">
              <p className="text-sm font-medium text-gray-500">Total Liabilities</p>
              {loading ? <div className="skeleton h-8 w-28 mt-1" /> : <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalLiabilities)}</p>}
            </div>
            <div className="stat-card">
              <p className="text-sm font-medium text-gray-500">Total Revenue</p>
              {loading ? <div className="skeleton h-8 w-28 mt-1" /> : <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalRevenue)}</p>}
            </div>
            <div className="stat-card">
              <p className="text-sm font-medium text-gray-500">Total Expenses</p>
              {loading ? <div className="skeleton h-8 w-28 mt-1" /> : <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalExpenses)}</p>}
            </div>
          </div>

          {/* Grouped Accounts */}
          {loading ? (
            <div className="card overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-6 py-3 border-b border-gray-100">
                  <div className="skeleton h-4 w-48" />
                </div>
              ))}
            </div>
          ) : (
            Object.entries(groupedAccounts).map(([type, accs]) => (
              <div key={type} className="card overflow-hidden">
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">{type}</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Code</th>
                      <th className="table-header">Account Name</th>
                      <th className="table-header text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {accs.map((acc) => (
                      <tr key={acc.id} className="hover:bg-gray-50">
                        <td className="table-cell font-mono text-gray-500 text-sm">{acc.code}</td>
                        <td className="table-cell font-medium text-gray-900">{acc.name}</td>
                        <td className="table-cell text-right font-medium">{formatCurrency(acc.balance || 0)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50">
                      <td className="table-cell" colSpan={2}>
                        <span className="font-semibold text-gray-700">Total {type}</span>
                      </td>
                      <td className="table-cell text-right font-bold text-gray-900">
                        {formatCurrency(accs.reduce((s, a) => s + (a.balance || 0), 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {tab === 'Transactions' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="table-header">Date</th>
                    <th className="table-header">Reference</th>
                    <th className="table-header">Description</th>
                    <th className="table-header">Account</th>
                    <th className="table-header text-right">Debit</th>
                    <th className="table-header text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <td className="table-cell"><div className="skeleton h-4 w-20" /></td>
                        <td className="table-cell"><div className="skeleton h-4 w-16" /></td>
                        <td className="table-cell"><div className="skeleton h-4 w-40" /></td>
                        <td className="table-cell"><div className="skeleton h-4 w-24" /></td>
                        <td className="table-cell"><div className="skeleton h-4 w-16" /></td>
                        <td className="table-cell"><div className="skeleton h-4 w-16" /></td>
                      </tr>
                    ))
                  ) : filteredTransactions.length > 0 ? (
                    filteredTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="table-cell text-gray-500 text-sm">{t.date}</td>
                        <td className="table-cell font-mono text-sm text-brand-600">{t.reference}</td>
                        <td className="table-cell text-gray-900">{t.description}</td>
                        <td className="table-cell text-gray-500">{t.account || '-'}</td>
                        <td className="table-cell text-right">{t.debit ? formatCurrency(t.debit) : '-'}</td>
                        <td className="table-cell text-right">{t.credit ? formatCurrency(t.credit) : '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No transactions found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {tab === 'Reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Balance Sheet</h3>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-6 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium text-gray-700">Total Assets</span>
                  <span className="font-bold text-gray-900">{formatCurrency(totalAssets)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium text-gray-700">Total Liabilities</span>
                  <span className="font-bold text-gray-900">{formatCurrency(totalLiabilities)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium text-gray-700">Equity</span>
                  <span className="font-bold text-gray-900">{formatCurrency(totalAssets - totalLiabilities)}</span>
                </div>
                <div className="flex justify-between py-2 bg-brand-50 px-3 rounded-lg">
                  <span className="font-semibold text-brand-700">Net Position</span>
                  <span className="font-bold text-brand-700">{formatCurrency(totalAssets - totalLiabilities)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Profit & Loss</h3>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-6 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium text-gray-700">Total Revenue</span>
                  <span className="font-bold text-green-600">{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium text-gray-700">Total Expenses</span>
                  <span className="font-bold text-red-600">{formatCurrency(totalExpenses)}</span>
                </div>
                <div className={`flex justify-between py-2 px-3 rounded-lg ${totalRevenue - totalExpenses >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className={`font-semibold ${totalRevenue - totalExpenses >= 0 ? 'text-green-700' : 'text-red-700'}`}>Net Income</span>
                  <span className={`font-bold ${totalRevenue - totalExpenses >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(totalRevenue - totalExpenses)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
