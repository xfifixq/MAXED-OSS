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
  const [transactionSearch, setTransactionSearch] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('');

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

  const accountTypes = useMemo(
    () => Array.from(new Set(ledger.accounts.map((account) => account.type).filter(Boolean))).sort(),
    [ledger.accounts],
  );

  const filteredAccounts = useMemo(
    () => ledger.accounts.filter((account) => !accountTypeFilter || account.type === accountTypeFilter),
    [accountTypeFilter, ledger.accounts],
  );

  const filteredTransactions = useMemo(() => {
    const query = transactionSearch.trim().toLowerCase();
    if (!query) return ledger.transactions;

    return ledger.transactions.filter((transaction) =>
      [transaction.description, transaction.reference, transaction.contact]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [ledger.transactions, transactionSearch]);

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
      description="A deeper bookkeeping workspace for CPA review. Search recent ledger activity, inspect chart of accounts slices, and work from balance sheet and P&L detail without bouncing straight into Bigcapital."
      actions={
        <button onClick={loadLedger} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
          Refresh ledger
        </button>
      }
      metrics={
        <>
          <WorkspaceMetric label="Accounts" value={loading ? '--' : formatNumber(ledger.accounts.length)} detail="Live chart of accounts" />
          <WorkspaceMetric label="Assets" value={loading ? '--' : formatCurrency(totals.assets)} detail={`Liabilities ${formatCurrency(totals.liabilities)}`} />
          <WorkspaceMetric label="Net income" value={loading ? '--' : formatCurrency(totals.netIncome)} detail={`Revenue ${formatCurrency(totals.revenue)}`} />
          <WorkspaceMetric label="Transactions" value={loading ? '--' : formatNumber(ledger.transactions.length)} detail="Recent posted activity" />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadLedger} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <WorkspacePanel
          title="Recent transactions"
          description="Search posted bookkeeping activity by description, contact, or reference."
          action={
            <input
              value={transactionSearch}
              onChange={(event) => setTransactionSearch(event.target.value)}
              className="input min-w-[16rem]"
              placeholder="Search transactions..."
            />
          }
        >
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : filteredTransactions.length === 0 ? (
            <WorkspaceEmpty title="No transactions returned" message="Try a different search, or confirm the Bigcapital ledger has posted activity." />
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
                    {filteredTransactions.slice(0, 20).map((transaction) => (
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
          <WorkspacePanel title="Statement highlights" description="Top balance sheet and P&L lines surfaced for quick review.">
            {loading ? (
              <WorkspaceSkeleton rows={4} />
            ) : statementHighlights.length === 0 ? (
              <WorkspaceEmpty title="No statement lines available" message="Once Bigcapital is connected, Maxed will flatten statement detail into reusable review cards." />
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

          <WorkspacePanel
            title="Chart of accounts"
            description="Filter the account list by account type and review live balances."
            action={
              <select className="input min-w-[12rem]" value={accountTypeFilter} onChange={(event) => setAccountTypeFilter(event.target.value)}>
                <option value="">All account types</option>
                {accountTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            }
          >
            {loading ? (
              <WorkspaceSkeleton rows={4} />
            ) : filteredAccounts.length === 0 ? (
              <WorkspaceEmpty title="No accounts returned" message="The ledger is connected, but there are no accounts in this slice yet." />
            ) : (
              <div className="space-y-3">
                {filteredAccounts.slice(0, 10).map((account) => (
                  <div key={account.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900">{account.name}</p>
                        <p className="text-sm text-slate-500">{account.code || 'No code'} · {account.type || 'Other'}</p>
                      </div>
                      <p className="text-base font-semibold text-slate-950">{formatCurrency(account.balance, account.currency || 'USD')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </WorkspacePanel>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Balance sheet detail" description="Flattened Bigcapital balance sheet lines available for CPA review.">
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : ledger.balanceSheet.length === 0 ? (
            <WorkspaceEmpty title="No balance sheet data" message="Balance sheet lines will appear here once Bigcapital returns statement detail." />
          ) : (
            <div className="space-y-3">
              {ledger.balanceSheet.slice(0, 14).map((line) => (
                <div key={`${line.label}-${line.amount}`} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <p className="font-medium text-slate-900">{line.label}</p>
                  <p className="text-sm font-semibold text-slate-950">{formatCurrency(line.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Profit and loss detail" description="Flattened income statement lines for quick review and follow-up.">
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : ledger.profitLoss.length === 0 ? (
            <WorkspaceEmpty title="No P&L data" message="Profit-and-loss lines will appear here once Bigcapital returns statement detail." />
          ) : (
            <div className="space-y-3">
              {ledger.profitLoss.slice(0, 14).map((line) => (
                <div key={`${line.label}-${line.amount}`} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <p className="font-medium text-slate-900">{line.label}</p>
                  <p className="text-sm font-semibold text-slate-950">{formatCurrency(line.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>
    </WorkspaceShell>
  );
}
