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
import { firmFetch } from '@/lib/service-client';
import {
  findStatementAmount,
  formatCurrency,
  formatDate,
  formatNumber,
  normalizeFirmClients,
  normalizeBigcapitalAccounts,
  normalizeBigcapitalManualJournals,
  normalizeBigcapitalStatement,
  normalizeBigcapitalTransactions,
} from '@/lib/service-adapters';

type DraftAccount = {
  name: string;
  code: string;
  accountType: string;
  currencyCode: string;
};

type DraftJournal = {
  date: string;
  reference: string;
  description: string;
  amount: string;
  debitAccountId: string;
  creditAccountId: string;
};

type LedgerState = {
  clients: ReturnType<typeof normalizeFirmClients>;
  accounts: ReturnType<typeof normalizeBigcapitalAccounts>;
  transactions: ReturnType<typeof normalizeBigcapitalTransactions>;
  balanceSheet: ReturnType<typeof normalizeBigcapitalStatement>;
  profitLoss: ReturnType<typeof normalizeBigcapitalStatement>;
  manualJournals: ReturnType<typeof normalizeBigcapitalManualJournals>;
};

const EMPTY_LEDGER: LedgerState = {
  clients: [],
  accounts: [],
  transactions: [],
  balanceSheet: [],
  profitLoss: [],
  manualJournals: [],
};

type BookkeepingWorkspacePayload = {
  workspace?: {
    configured?: boolean;
    health?: string;
    liveProbe?: {
      reason?: string;
      status?: number;
    };
  };
  issues?: Array<{
    operation?: string;
    reason?: string;
    status?: number;
    detail?: string;
  }>;
  data?: {
    clients?: unknown;
    accounts?: unknown;
    transactions?: unknown;
    balanceSheet?: unknown;
    profitLoss?: unknown;
    manualJournals?: unknown;
  };
};

const ACCOUNT_TYPE_OPTIONS = [
  'asset',
  'liability',
  'equity',
  'income',
  'expense',
  'bank',
  'accounts_receivable',
  'accounts_payable',
] as const;

export default function BookkeepingPage() {
  const { isReady } = useFirmReady();
  const [ledger, setLedger] = useState<LedgerState>(EMPTY_LEDGER);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingJournal, setSavingJournal] = useState(false);
  const [publishingJournalId, setPublishingJournalId] = useState('');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('');
  const [contactFilter, setContactFilter] = useState('');
  const [accountDraft, setAccountDraft] = useState<DraftAccount>({
    name: '',
    code: '',
    accountType: 'expense',
    currencyCode: 'USD',
  });
  const [journalDraft, setJournalDraft] = useState<DraftJournal>({
    date: new Date().toISOString().slice(0, 10),
    reference: '',
    description: 'Manual adjustment',
    amount: '',
    debitAccountId: '',
    creditAccountId: '',
  });

  const loadLedger = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');
    setWarning('');

    try {
      const payload = await firmFetch<BookkeepingWorkspacePayload>('/workspaces/bookkeeping');
      const issue = payload.issues?.[0];
      const probeReason = payload.workspace?.liveProbe?.reason?.replace(/_/g, ' ');

      if (issue) {
        setWarning(
          `Bigcapital needs repair before live ledger data is trustworthy. ${issue.operation || 'connector'} failed: ${issue.reason || 'unknown'}${issue.status ? ` (HTTP ${issue.status})` : ''}${issue.detail ? ` · ${issue.detail}` : ''}`,
        );
      } else if (payload.workspace?.configured && payload.workspace?.health !== 'connected') {
        setWarning(`Bigcapital is mapped in Maxed, but the live connector still needs repair: ${probeReason || 'unknown issue'}.`);
      }

      setLedger({
        clients: normalizeFirmClients(payload.data?.clients),
        accounts: normalizeBigcapitalAccounts(payload.data?.accounts),
        transactions: normalizeBigcapitalTransactions(payload.data?.transactions),
        balanceSheet: normalizeBigcapitalStatement(payload.data?.balanceSheet),
        profitLoss: normalizeBigcapitalStatement(payload.data?.profitLoss),
        manualJournals: normalizeBigcapitalManualJournals(payload.data?.manualJournals),
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

  useEffect(() => {
    if (!ledger.accounts.length) return;
    setJournalDraft((current) => {
      const debitAccountId = current.debitAccountId || ledger.accounts[0]?.id || '';
      const creditFallback = ledger.accounts.find((account) => account.id !== debitAccountId)?.id || ledger.accounts[0]?.id || '';
      return {
        ...current,
        debitAccountId,
        creditAccountId: current.creditAccountId || creditFallback,
      };
    });
  }, [ledger.accounts]);

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
    return ledger.transactions.filter((transaction) => {
      if (contactFilter && transaction.contact !== contactFilter) return false;
      if (!query) return true;
      return [transaction.description, transaction.reference, transaction.contact]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [contactFilter, ledger.transactions, transactionSearch]);

  const statementHighlights = useMemo(() => {
    const highlights = [...ledger.balanceSheet, ...ledger.profitLoss]
      .filter((line) => line.label && Math.abs(line.amount) > 0)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    return highlights.slice(0, 8);
  }, [ledger.balanceSheet, ledger.profitLoss]);

  const contacts = useMemo(
    () => Array.from(new Set(ledger.transactions.map((transaction) => transaction.contact).filter(Boolean))).sort(),
    [ledger.transactions],
  );

  const contactActivity = useMemo(() => {
    const totals = new Map<string, { count: number; amount: number }>();

    ledger.transactions.forEach((transaction) => {
      if (!transaction.contact) return;
      const current = totals.get(transaction.contact) || { count: 0, amount: 0 };
      current.count += 1;
      current.amount += transaction.amount;
      totals.set(transaction.contact, current);
    });

    return Array.from(totals.entries())
      .map(([contact, detail]) => ({ contact, ...detail }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 8);
  }, [ledger.transactions]);

  const accountTypeSummary = useMemo(() => {
    const totals = new Map<string, { count: number; balance: number }>();

    ledger.accounts.forEach((account) => {
      const key = account.type || 'Other';
      const current = totals.get(key) || { count: 0, balance: 0 };
      current.count += 1;
      current.balance += account.balance;
      totals.set(key, current);
    });

    return Array.from(totals.entries())
      .map(([type, detail]) => ({ type, ...detail }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, [ledger.accounts]);

  const clientAccountingCoverage = useMemo(
    () =>
      ledger.clients.map((client) => ({
        id: client.id,
        name: client.name,
        hasLedgerLink: Boolean(client.bigcapitalId),
        hasBillingLink: Boolean(client.invoiceNinjaId),
        hasDocumentTag: Boolean(client.paperlessTag),
      })),
    [ledger.clients],
  );

  const createAccount = useCallback(async () => {
    if (!accountDraft.name.trim()) return;

    setSavingAccount(true);
    setError('');

    try {
      await firmFetch('/workspaces/bookkeeping/accounts', {
        method: 'POST',
        body: JSON.stringify(accountDraft),
      });
      setAccountDraft({
        name: '',
        code: '',
        accountType: 'expense',
        currencyCode: 'USD',
      });
      await loadLedger();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setSavingAccount(false);
    }
  }, [accountDraft, loadLedger]);

  const createManualJournal = useCallback(async () => {
    if (!journalDraft.debitAccountId || !journalDraft.creditAccountId || !journalDraft.amount) return;

    setSavingJournal(true);
    setError('');

    try {
      await firmFetch('/workspaces/bookkeeping/manual-journals', {
        method: 'POST',
        body: JSON.stringify({
          ...journalDraft,
          amount: Number(journalDraft.amount),
        }),
      });
      setJournalDraft((current) => ({
        ...current,
        reference: '',
        description: 'Manual adjustment',
        amount: '',
      }));
      await loadLedger();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create manual journal.');
    } finally {
      setSavingJournal(false);
    }
  }, [journalDraft, loadLedger]);

  const publishManualJournal = useCallback(
    async (journalId: string) => {
      setPublishingJournalId(journalId);
      setError('');

      try {
        await firmFetch(`/workspaces/bookkeeping/manual-journals/${journalId}/publish`, {
          method: 'POST',
        });
        await loadLedger();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to publish manual journal.');
      } finally {
        setPublishingJournalId('');
      }
    },
    [loadLedger],
  );

  return (
    <WorkspaceShell
      service="bigcapital"
      eyebrow="Maxed Ledger"
      title="Maxed Ledger"
      description="A bookkeeping workspace for CPA review. Search recent ledger activity, inspect chart of accounts slices, and work from balance sheet and P&L detail inside Maxed."
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
      {warning ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">{warning}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <WorkspacePanel
          title="Recent transactions"
          description="Search posted bookkeeping activity by description, contact, or reference."
          action={
            <div className="flex flex-wrap gap-3">
              <input
                value={transactionSearch}
                onChange={(event) => setTransactionSearch(event.target.value)}
                className="input min-w-[16rem]"
                placeholder="Search transactions..."
              />
              <select className="input min-w-[14rem]" value={contactFilter} onChange={(event) => setContactFilter(event.target.value)}>
                <option value="">All counterparties</option>
                {contacts.map((contact) => (
                  <option key={contact} value={contact}>
                    {contact}
                  </option>
                ))}
              </select>
            </div>
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

      <div className="grid gap-6 xl:grid-cols-3">
        <WorkspacePanel title="Account mix" description="Summarized account coverage by type for faster ledger review.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : accountTypeSummary.length === 0 ? (
            <WorkspaceEmpty title="No account mix available" message="Account types will summarize here once Bigcapital returns the chart of accounts." />
          ) : (
            <div className="space-y-3">
              {accountTypeSummary.slice(0, 8).map((entry) => (
                <div key={entry.type} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{entry.type}</p>
                    <p className="text-sm text-slate-500">{entry.count} account{entry.count === 1 ? '' : 's'}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-950">{formatCurrency(entry.balance)}</p>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Counterparty activity" description="Biggest contacts by transaction volume in the current ledger slice.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : contactActivity.length === 0 ? (
            <WorkspaceEmpty title="No counterparty activity" message="Transactions with contact data will roll up here for review." />
          ) : (
            <div className="space-y-3">
              {contactActivity.map((entry) => (
                <div key={entry.contact} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{entry.contact}</p>
                    <p className="text-sm text-slate-500">{entry.count} transaction{entry.count === 1 ? '' : 's'}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-950">{formatCurrency(entry.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Client accounting coverage" description="Cross-check which Maxed clients are fully linked across accounting, billing, and documents.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : clientAccountingCoverage.length === 0 ? (
            <WorkspaceEmpty title="No clients available" message="Create client records first to track accounting-system coverage." />
          ) : (
            <div className="space-y-3">
              {clientAccountingCoverage.slice(0, 8).map((client) => (
                <div key={client.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <p className="font-medium text-slate-900">{client.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className={client.hasLedgerLink ? 'badge-green' : 'badge-yellow'}>
                      {client.hasLedgerLink ? 'Ledger linked' : 'Ledger missing'}
                    </span>
                    <span className={client.hasBillingLink ? 'badge-green' : 'badge-yellow'}>
                      {client.hasBillingLink ? 'Billing linked' : 'Billing missing'}
                    </span>
                    <span className={client.hasDocumentTag ? 'badge-green' : 'badge-yellow'}>
                      {client.hasDocumentTag ? 'Docs tagged' : 'Docs missing tag'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Adjusting entries" description="Create accounts and post manual journals without leaving Maxed.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Create account</p>
                  <p className="mt-1 text-sm text-slate-500">Add a new ledger account to the chart from the Maxed workspace.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Account name</label>
                  <input
                    className="input mt-2"
                    value={accountDraft.name}
                    onChange={(event) => setAccountDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Payroll tax expense"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Code</label>
                    <input
                      className="input mt-2"
                      value={accountDraft.code}
                      onChange={(event) => setAccountDraft((current) => ({ ...current, code: event.target.value }))}
                      placeholder="6100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Type</label>
                    <select
                      className="input mt-2"
                      value={accountDraft.accountType}
                      onChange={(event) => setAccountDraft((current) => ({ ...current, accountType: event.target.value }))}
                    >
                      {ACCOUNT_TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button onClick={createAccount} disabled={savingAccount || !accountDraft.name.trim()} className="btn-primary w-full disabled:opacity-60">
                  {savingAccount ? 'Creating account...' : 'Create account'}
                </button>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Post manual journal</p>
                  <p className="mt-1 text-sm text-slate-500">Create a two-sided adjusting entry directly from Maxed.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Date</label>
                    <input
                      type="date"
                      className="input mt-2"
                      value={journalDraft.date}
                      onChange={(event) => setJournalDraft((current) => ({ ...current, date: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input mt-2"
                      value={journalDraft.amount}
                      onChange={(event) => setJournalDraft((current) => ({ ...current, amount: event.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Memo</label>
                  <input
                    className="input mt-2"
                    value={journalDraft.description}
                    onChange={(event) => setJournalDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Accrue payroll taxes"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Debit account</label>
                    <select
                      className="input mt-2"
                      value={journalDraft.debitAccountId}
                      onChange={(event) => setJournalDraft((current) => ({ ...current, debitAccountId: event.target.value }))}
                    >
                      {ledger.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Credit account</label>
                    <select
                      className="input mt-2"
                      value={journalDraft.creditAccountId}
                      onChange={(event) => setJournalDraft((current) => ({ ...current, creditAccountId: event.target.value }))}
                    >
                      {ledger.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={createManualJournal}
                  disabled={savingJournal || !journalDraft.debitAccountId || !journalDraft.creditAccountId || !journalDraft.amount}
                  className="btn-primary w-full disabled:opacity-60"
                >
                  {savingJournal ? 'Posting journal...' : 'Post manual journal'}
                </button>
              </div>
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Recent manual journals" description="Review and publish draft adjusting entries created in Bigcapital.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : ledger.manualJournals.length === 0 ? (
            <WorkspaceEmpty title="No manual journals yet" message="Adjusting entries created in Maxed or Bigcapital will appear here." />
          ) : (
            <div className="space-y-3">
              {ledger.manualJournals.slice(0, 10).map((journal) => {
                const isPublished = /publish/.test(journal.status.toLowerCase()) || Boolean(journal.publishedAt);
                return (
                  <div key={journal.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">{journal.description}</p>
                          <span className={isPublished ? 'badge-green' : 'badge-yellow'}>
                            {isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {journal.reference || 'No reference'} · {formatDate(journal.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-slate-950">{formatCurrency(journal.amount)}</p>
                        {!isPublished ? (
                          <button
                            onClick={() => publishManualJournal(journal.id)}
                            disabled={publishingJournalId === journal.id}
                            className="btn-secondary disabled:opacity-60"
                          >
                            {publishingJournalId === journal.id ? 'Publishing...' : 'Publish'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </WorkspacePanel>

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
