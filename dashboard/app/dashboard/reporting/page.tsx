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
  formatDateTime,
  normalizeBigcapitalStatement,
  normalizeMetabaseDashboardDetail,
  normalizeMetabaseDashboards,
  normalizeMetabaseQueryPreview,
  normalizeMetabaseQuestionDetail,
  normalizeMetabaseQuestions,
} from '@/lib/service-adapters';

type StatsPayload = {
  totalClients?: number;
  pendingInvoices?: number;
  activeWorkflows?: number;
  totalRevenue?: number;
};

type ReportingWorkspacePayload = {
  workspace?: {
    configured?: boolean;
    health?: string;
    liveProbe?: {
      reason?: string;
    };
  };
  issues?: Array<{
    service?: string;
    operation?: string;
    reason?: string;
    status?: number;
    detail?: string;
  }>;
  data?: {
    stats?: StatsPayload;
    dashboards?: unknown;
    questions?: unknown;
    balanceSheet?: unknown;
    profitLoss?: unknown;
  };
};

export default function ReportingPage() {
  const { isReady } = useFirmReady();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [stats, setStats] = useState<StatsPayload>({});
  const [dashboards, setDashboards] = useState<ReturnType<typeof normalizeMetabaseDashboards>>([]);
  const [questions, setQuestions] = useState<ReturnType<typeof normalizeMetabaseQuestions>>([]);
  const [balanceSheet, setBalanceSheet] = useState<ReturnType<typeof normalizeBigcapitalStatement>>([]);
  const [profitLoss, setProfitLoss] = useState<ReturnType<typeof normalizeBigcapitalStatement>>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState('');
  const [selectedDashboard, setSelectedDashboard] = useState<ReturnType<typeof normalizeMetabaseDashboardDetail>>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState<ReturnType<typeof normalizeMetabaseQuestionDetail>>(null);
  const [questionPreview, setQuestionPreview] = useState<ReturnType<typeof normalizeMetabaseQueryPreview>>({ columns: [], rows: [] });
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [runningQuestion, setRunningQuestion] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [questionSearch, setQuestionSearch] = useState('');

  const loadAnalytics = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');
    setWarning('');

    try {
      const payload = await firmFetch<ReportingWorkspacePayload>('/workspaces/reporting');
      const issue = payload.issues?.[0];
      const probeReason = payload.workspace?.liveProbe?.reason?.replace(/_/g, ' ');
      const nextDashboards = normalizeMetabaseDashboards(payload.data?.dashboards);
      const nextQuestions = normalizeMetabaseQuestions(payload.data?.questions);

      setStats(payload.data?.stats || {});
      setDashboards(nextDashboards);
      setQuestions(nextQuestions);
      setBalanceSheet(normalizeBigcapitalStatement(payload.data?.balanceSheet));
      setProfitLoss(normalizeBigcapitalStatement(payload.data?.profitLoss));

      setSelectedDashboardId((current) => {
        if (current && nextDashboards.some((dashboard) => dashboard.id === current)) return current;
        return nextDashboards[0]?.id || '';
      });
      setSelectedQuestionId((current) => {
        if (current && nextQuestions.some((question) => question.id === current)) return current;
        return nextQuestions[0]?.id || '';
      });

      if (issue) {
        const serviceName = issue.service ? issue.service.replace(/_/g, ' ') : 'connector';
        setWarning(`Reporting needs repair before live analytics are trustworthy. ${serviceName} ${issue.operation || 'connector'} failed: ${issue.reason || 'unknown'}${issue.status ? ` (HTTP ${issue.status})` : ''}${issue.detail ? ` · ${issue.detail}` : ''}`);
      } else if (payload.workspace?.configured && payload.workspace?.health !== 'connected') {
        setWarning(`Metabase is mapped in Maxed, but the live connector still needs repair: ${probeReason || 'unknown issue'}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analytics.');
      setStats({});
      setDashboards([]);
      setQuestions([]);
      setBalanceSheet([]);
      setProfitLoss([]);
      setSelectedDashboardId('');
      setSelectedQuestionId('');
      setSelectedQuestion(null);
      setQuestionPreview({ columns: [], rows: [] });
    }

    setLoading(false);
  }, [isReady]);

  const loadSelectedDashboard = useCallback(async () => {
    if (!selectedDashboardId || !isReady) {
      setSelectedDashboard(null);
      return;
    }

    try {
      const payload = await firmFetch(`/workspaces/reporting/dashboards/${selectedDashboardId}`);
      setSelectedDashboard(normalizeMetabaseDashboardDetail(payload));
    } catch {
      setSelectedDashboard(null);
    }
  }, [isReady, selectedDashboardId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    loadSelectedDashboard();
  }, [loadSelectedDashboard]);

  const loadSelectedQuestion = useCallback(async () => {
    if (!selectedQuestionId || !isReady) {
      setSelectedQuestion(null);
      setQuestionPreview({ columns: [], rows: [] });
      return;
    }

    setLoadingQuestion(true);
    try {
      const [detailPayload, previewPayload] = await Promise.all([
        firmFetch(`/workspaces/reporting/questions/${selectedQuestionId}`),
        firmFetch(`/workspaces/reporting/questions/${selectedQuestionId}/query`, {
          method: 'POST',
          body: JSON.stringify({}),
        }),
      ]);
      setSelectedQuestion(normalizeMetabaseQuestionDetail(detailPayload));
      setQuestionPreview(normalizeMetabaseQueryPreview(previewPayload));
    } catch {
      setSelectedQuestion(null);
      setQuestionPreview({ columns: [], rows: [] });
    } finally {
      setLoadingQuestion(false);
    }
  }, [isReady, selectedQuestionId]);

  useEffect(() => {
    loadSelectedQuestion();
  }, [loadSelectedQuestion]);

  const runSelectedQuestion = useCallback(async () => {
    if (!selectedQuestionId) return;

    setRunningQuestion(true);
    try {
      const payload = await firmFetch(`/workspaces/reporting/questions/${selectedQuestionId}/query`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setQuestionPreview(normalizeMetabaseQueryPreview(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run saved question.');
    } finally {
      setRunningQuestion(false);
    }
  }, [selectedQuestionId]);

  const totals = useMemo(() => {
    const revenue = findStatementAmount(profitLoss, [/\brevenue\b/, /\bincome\b/]);
    const expenses = findStatementAmount(profitLoss, [/\bexpense\b/, /\bcost\b/]);
    const netIncome = findStatementAmount(profitLoss, [/net income/, /net profit/, /^profit$/]) || revenue - expenses;
    const assets = findStatementAmount(balanceSheet, [/asset/]);
    return { revenue, expenses, netIncome, assets };
  }, [balanceSheet, profitLoss]);

  const filteredDashboards = useMemo(() => {
    const query = dashboardSearch.trim().toLowerCase();
    if (!query) return dashboards;
    return dashboards.filter((dashboard) =>
      [dashboard.name, dashboard.description].join(' ').toLowerCase().includes(query),
    );
  }, [dashboardSearch, dashboards]);

  const filteredQuestions = useMemo(() => {
    const query = questionSearch.trim().toLowerCase();
    const ordered = [...questions].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    if (!query) return ordered;
    return ordered.filter((question) =>
      [question.name, question.description, question.display].join(' ').toLowerCase().includes(query),
    );
  }, [questionSearch, questions]);

  const financeReviewCards = useMemo(
    () => [
      { label: 'Revenue', value: totals.revenue },
      { label: 'Expenses', value: totals.expenses },
      { label: 'Net income', value: totals.netIncome },
      { label: 'Assets', value: totals.assets },
    ],
    [totals.assets, totals.expenses, totals.netIncome, totals.revenue],
  );

  return (
    <WorkspaceShell
      service="metabase"
      eyebrow="Maxed Analytics"
      title="Maxed Analytics"
      description="A fuller reporting hub for CPA review. Work from firm KPIs, accounting signals, dashboard inventory, and question libraries without leaving the Maxed shell."
      actions={
        <button onClick={loadAnalytics} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
          Refresh analytics
        </button>
      }
      metrics={
        <>
          <WorkspaceMetric label="Managed revenue" value={loading ? '--' : formatCurrency(stats.totalRevenue || 0)} detail={`${stats.totalClients || 0} active clients`} />
          <WorkspaceMetric label="Pending invoices" value={loading ? '--' : String(stats.pendingInvoices || 0)} detail="Outstanding follow-up" />
          <WorkspaceMetric label="Saved dashboards" value={loading ? '--' : String(dashboards.length)} detail="Analytics catalog surfaced in Maxed" />
          <WorkspaceMetric label="Net income" value={loading ? '--' : formatCurrency(totals.netIncome)} detail={`Assets ${formatCurrency(totals.assets)}`} />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadAnalytics} /> : null}
      {warning ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">{warning}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.92fr,1.08fr]">
        <WorkspacePanel title="Performance snapshot" description="Fast finance review cards sourced from live ledger data and firm KPIs.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {financeReviewCards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <p className="text-sm font-medium text-slate-500">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(card.value)}</p>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel
          title="Dashboard catalog"
          description="Search and select saved dashboards without leaving Maxed."
          action={
            <input
              value={dashboardSearch}
              onChange={(event) => setDashboardSearch(event.target.value)}
              className="input min-w-[16rem]"
              placeholder="Search dashboards..."
            />
          }
        >
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : filteredDashboards.length === 0 ? (
            <WorkspaceEmpty title="No saved dashboards" message="Metabase is connected, but no dashboards match this search yet." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredDashboards.map((dashboard) => {
                const active = dashboard.id === selectedDashboardId;
                return (
                  <button
                    key={dashboard.id}
                    onClick={() => setSelectedDashboardId(dashboard.id)}
                    className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                      active
                        ? 'border-brand-300 bg-brand-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-semibold text-slate-900">{dashboard.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{dashboard.description || 'Saved dashboard'}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                      Updated {formatDate(dashboard.updatedAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </WorkspacePanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <WorkspacePanel title="Selected dashboard" description="Inspect the card inventory for the current analytics workspace.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : !selectedDashboard ? (
            <WorkspaceEmpty title="No dashboard selected" message="Choose a saved dashboard above to inspect its cards and question mix." />
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-base font-semibold text-slate-900">{selectedDashboard.name}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedDashboard.description || 'Saved dashboard overview'}</p>
              </div>
              {selectedDashboard.cards.length === 0 ? (
                <WorkspaceEmpty title="No dashboard cards" message="This dashboard exists, but Metabase did not return any card metadata for it." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedDashboard.cards.map((card) => (
                    <div key={card.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                      <p className="font-medium text-slate-900">{card.name}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">{card.display}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel
          title="Question library"
          description="Search recently updated Metabase questions inside Maxed."
          action={
            <input
              value={questionSearch}
              onChange={(event) => setQuestionSearch(event.target.value)}
              className="input min-w-[16rem]"
              placeholder="Search questions..."
            />
          }
        >
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : filteredQuestions.length === 0 ? (
            <WorkspaceEmpty title="No saved questions" message="Add saved questions in Metabase and they will appear here as first-class Maxed assets." />
          ) : (
            <div className="space-y-3">
              {filteredQuestions.slice(0, 10).map((question) => (
                <button
                  key={question.id}
                  onClick={() => setSelectedQuestionId(question.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                    question.id === selectedQuestionId
                      ? 'border-brand-300 bg-brand-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900">{question.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{question.description || 'Saved question'}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {question.display}
                    </span>
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                    Updated {formatDateTime(question.updatedAt)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <WorkspacePanel
          title="Selected question"
          description="Inspect a saved question and rerun it from inside Maxed."
          action={
            <button onClick={runSelectedQuestion} disabled={runningQuestion || !selectedQuestionId} className="btn-secondary disabled:opacity-60">
              {runningQuestion ? 'Refreshing...' : 'Refresh question'}
            </button>
          }
        >
          {loading || loadingQuestion ? (
            <WorkspaceSkeleton rows={4} />
          ) : !selectedQuestion ? (
            <WorkspaceEmpty title="No question selected" message="Choose a saved question above to inspect its definition and latest rows." />
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-base font-semibold text-slate-900">{selectedQuestion.name}</p>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {selectedQuestion.display}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">{selectedQuestion.description || 'Saved question surfaced through the Maxed analytics workspace.'}</p>
              </div>
              {questionPreview.rows.length === 0 ? (
                <WorkspaceEmpty title="No preview rows" message="Run the saved question to inspect its current result set." />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          {questionPreview.columns.slice(0, 6).map((column) => (
                            <th key={column} className="table-header">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {questionPreview.rows.slice(0, 8).map((row, index) => (
                          <tr key={`${selectedQuestion.id}-${index}`} className="hover:bg-slate-50">
                            {questionPreview.columns.slice(0, 6).map((column) => (
                              <td key={column} className="table-cell text-slate-600">
                                {String(row[column] ?? '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Finance statement detail" description="Balance sheet and profit-and-loss lines remain available alongside saved analytics assets.">
          {loading ? (
            <WorkspaceSkeleton rows={6} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">Balance sheet</p>
                {balanceSheet.length === 0 ? (
                  <WorkspaceEmpty title="No balance sheet lines" message="Connect Bigcapital to surface live balance sheet detail here." />
                ) : (
                  balanceSheet.slice(0, 8).map((line) => (
                    <div key={`${line.label}-${line.amount}`} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                      <p className="font-medium text-slate-900">{line.label}</p>
                      <p className="text-sm font-semibold text-slate-950">{formatCurrency(line.amount)}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">Profit and loss</p>
                {profitLoss.length === 0 ? (
                  <WorkspaceEmpty title="No P&L lines" message="Connect Bigcapital to surface live income statement detail here." />
                ) : (
                  profitLoss.slice(0, 8).map((line) => (
                    <div key={`${line.label}-${line.amount}`} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                      <p className="font-medium text-slate-900">{line.label}</p>
                      <p className="text-sm font-semibold text-slate-950">{formatCurrency(line.amount)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </WorkspacePanel>
      </div>
    </WorkspaceShell>
  );
}
