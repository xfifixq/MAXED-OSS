'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceMetric,
  WorkspacePanel,
  WorkspaceShell,
  WorkspaceSkeleton,
} from '@/components/WorkspaceShell';
import { useFirmReady } from '@/lib/useFirmReady';
import { serviceFetch } from '@/lib/service-client';
import {
  findStatementAmount,
  formatCurrency,
  formatDate,
  formatNumber,
  normalizeBigcapitalAccounts,
  normalizeBigcapitalStatement,
  normalizeBigcapitalTransactions,
} from '@/lib/service-adapters';

type LedgerState = {
  accounts: ReturnType<typeof normalizeBigcapitalAccounts>;
  transactions: ReturnType<typeof normalizeBigcapitalTransactions>;
  balanceSheet: ReturnType<typeof normalizeBigcapitalStatement>;
  profitLoss: ReturnType<typeof normalizeBigcapitalStatement>;
};

const EMPTY_LEDGER: LedgerState = {
  accounts: [],
  transactions: [],
  balanceSheet: [],
  profitLoss: [],
};

export default function BookkeepingPage() {
  const { isReady } = useFirmReady();
  const [ledger, setLedger] = useState<LedgerState>(EMPTY_LEDGER);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLedger = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');

    try {
      const [accountsPayload, transactionsPayload, balanceSheetPayload, profitLossPayload] = await Promise.all([
        serviceFetch('/api/services/bigcapital/accounts'),
        serviceFetch('/api/services/bigcapital/transactions'),
        serviceFetch('/api/services/bigcapital/balance-sheet'),
        serviceFetch('/api/services/bigcapital/profit-loss'),
      ]);

      setLedger({
        accounts: normalizeBigcapitalAccounts(accountsPayload),
        transactions: normalizeBigcapitalTransactions(transactionsPayload),
        balanceSheet: normalizeBigcapitalStatement(balanceSheetPayload),
        profitLoss: normalizeBigcapitalStatement(profitLossPayload),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ledger data.');
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const totals = useMemo(() => {
    const assets = findStatementAmount(ledger.balanceSheet, [/asset/]);
    const liabilities = findStatementAmount(ledger.balanceSheet, [/liabilit/]);
    const equity = findStatementAmount(ledger.balanceSheet, [/equity/]);
    const revenue = findStatementAmount(ledger.profitLoss, [/\brevenue\b/, /\bincome\b/]);
    const expenses = findStatementAmount(ledger.profitLoss, [/\bexpense\b/, /\bcost\b/]);
    const netIncome =
      findStatementAmount(ledger.profitLoss, [/net income/, /net profit/, /^profit$/]) || revenue - expenses;

    return { assets, liabilities, equity, revenue, expenses, netIncome };
  }, [ledger.balanceSheet, ledger.profitLoss]);

  const accountGroups = useMemo(() => {
    const groups = ledger.accounts.reduce<Record<string, { count: number; balance: number }>>((acc, account) => {
      const key = account.type || 'Other';
      if (!acc[key]) acc[key] = { count: 0, balance: 0 };
      acc[key].count += 1;
      acc[key].balance += account.balance;
      return acc;
    }, {});

    return Object.entries(groups)
      .map(([label, value]) => ({ label, ...value }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 6);
  }, [ledger.accounts]);

  const statementHighlights = useMemo(() => {
    const highlights = [...ledger.balanceSheet, ...ledger.profitLoss]
      .filter((line) => line.label && Math.abs(line.amount) > 0)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    return highlights.slice(0, 8);
  }, [ledger.balanceSheet, ledger.profitLoss]);

  return (
    <WorkspaceShell
      service="bigcapital"
      eyebrow="Native Ledger"
      title="Maxed Ledger"
      description="A native bookkeeping workspace for account balances, statement health, and recent journal activity. Bigcapital remains the system of record behind the scenes, but the CPA workflow now stays inside Maxed."
      actions={
        <button onClick={loadLedger} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
          Refresh ledger
        </button>
      }
      metrics={
        <>
          <WorkspaceMetric label="Accounts" value={loading ? '--' : formatNumber(ledger.accounts.length)} detail="Live chart of accounts" />
          <WorkspaceMetric label="Total assets" value={loading ? '--' : formatCurrency(totals.assets)} detail={`Liabilities ${formatCurrency(totals.liabilities)}`} />
          <WorkspaceMetric label="Net income" value={loading ? '--' : formatCurrency(totals.netIncome)} detail={`Revenue ${formatCurrency(totals.revenue)}`} />
          <WorkspaceMetric label="Recent activity" value={loading ? '--' : formatNumber(ledger.transactions.length)} detail="Latest posted transactions" />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadLedger} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
        <WorkspacePanel
          title="Recent transactions"
          description="Posted bookkeeping activity pulled through the Bigcapital adapter."
        >
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : ledger.transactions.length === 0 ? (
            <WorkspaceEmpty
              title="No transactions yet"
              message="Transactions will appear here once the ledger connection is configured and activity has synced."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="table-header">Date</th>
                      <th className="table-header">Description</th>
                      <th className="table-header">Reference</th>
                      <th className="table-header">Contact</th>
                      <th className="table-header text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {ledger.transactions.slice(0, 12).map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-slate-50">
                        <td className="table-cell text-slate-500">{formatDate(transaction.date)}</td>
                        <td className="table-cell font-medium text-slate-900">{transaction.description}</td>
                        <td className="table-cell text-slate-500">{transaction.reference || '—'}</td>
                        <td className="table-cell text-slate-500">{transaction.contact || '—'}</td>
                        <td className="table-cell text-right font-medium text-slate-900">
                          {formatCurrency(transaction.amount, transaction.currency || 'USD')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </WorkspacePanel>

        <div className="space-y-6">
          <WorkspacePanel title="Statement highlights" description="Top balance sheet and P&L lines surfaced natively.">
            {loading ? (
              <WorkspaceSkeleton rows={4} />
            ) : statementHighlights.length === 0 ? (
              <WorkspaceEmpty
                title="No statement lines available"
                message="Once Bigcapital is connected, Maxed will flatten your balance sheet and P&L into reusable workspace cards."
              />
            ) : (
              <div className="space-y-3">
                {statementHighlights.map((line) => (
                  <div key={`${line.label}-${line.amount}`} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{line.label}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Live statement line</p>
                    </div>
                    <p className="text-lg font-semibold text-slate-950">{formatCurrency(line.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </WorkspacePanel>

          <WorkspacePanel title="Account mix" description="Which ledger buckets are carrying the most weight right now.">
            {loading ? (
              <WorkspaceSkeleton rows={4} />
            ) : accountGroups.length === 0 ? (
              <WorkspaceEmpty
                title="No accounts returned"
                message="The Bigcapital connection is active, but there are no account groups to summarize yet."
              />
            ) : (
              <div className="space-y-3">
                {accountGroups.map((group) => (
                  <div key={group.label} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900">{group.label}</p>
                        <p className="text-sm text-slate-500">{group.count} account{group.count === 1 ? '' : 's'}</p>
                      </div>
                      <p className="text-base font-semibold text-slate-950">{formatCurrency(group.balance)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </WorkspacePanel>
        </div>
      </div>

      <WorkspacePanel title="Balance sheet snapshot" description="Key accounting anchors surfaced without leaving the Maxed shell.">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-sm font-medium text-slate-500">Assets</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{loading ? '--' : formatCurrency(totals.assets)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-sm font-medium text-slate-500">Liabilities</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{loading ? '--' : formatCurrency(totals.liabilities)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-sm font-medium text-slate-500">Equity</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{loading ? '--' : formatCurrency(totals.equity)}</p>
          </div>
        </div>
      </WorkspacePanel>
    </WorkspaceShell>
  );
}
