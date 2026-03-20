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
import { firmFetch, serviceFetch } from '@/lib/service-client';
import {
  findStatementAmount,
  formatCurrency,
  formatDate,
  formatDateTime,
  normalizeBigcapitalStatement,
  normalizeMetabaseDashboardDetail,
  normalizeMetabaseDashboards,
  normalizeMetabaseQuestions,
} from '@/lib/service-adapters';

type StatsPayload = {
  totalClients?: number;
  pendingInvoices?: number;
  activeWorkflows?: number;
  totalRevenue?: number;
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

  const loadAnalytics = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');
    setWarning('');

    const results = await Promise.allSettled([
      firmFetch<StatsPayload>('/stats'),
      serviceFetch('/api/services/metabase/dashboards'),
      serviceFetch('/api/services/metabase/questions'),
      serviceFetch('/api/services/bigcapital/balance-sheet'),
      serviceFetch('/api/services/bigcapital/profit-loss'),
    ]);

    const [statsResult, dashboardsResult, questionsResult, balanceResult, profitResult] = results;

    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value || {});
    } else {
      setError(statsResult.reason instanceof Error ? statsResult.reason.message : 'Unable to load analytics.');
    }

    if (dashboardsResult.status === 'fulfilled') {
      const nextDashboards = normalizeMetabaseDashboards(dashboardsResult.value);
      setDashboards(nextDashboards);
      if (!selectedDashboardId && nextDashboards[0]?.id) {
        setSelectedDashboardId(nextDashboards[0].id);
      }
    } else {
      setWarning('Metabase dashboards are unavailable. Maxed analytics cards are still shown below.');
      setDashboards([]);
    }

    if (questionsResult.status === 'fulfilled') {
      setQuestions(normalizeMetabaseQuestions(questionsResult.value));
    } else {
      setQuestions([]);
    }

    if (balanceResult.status === 'fulfilled') {
      setBalanceSheet(normalizeBigcapitalStatement(balanceResult.value));
    } else {
      setBalanceSheet([]);
    }

    if (profitResult.status === 'fulfilled') {
      setProfitLoss(normalizeBigcapitalStatement(profitResult.value));
    } else {
      setProfitLoss([]);
    }

    setLoading(false);
  }, [isReady]);

  const loadSelectedDashboard = useCallback(async () => {
    if (!selectedDashboardId || !isReady) return;

    try {
      const payload = await serviceFetch(`/api/services/metabase/dashboard/${selectedDashboardId}`);
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

  const totals = useMemo(() => {
    const revenue = findStatementAmount(profitLoss, [/\brevenue\b/, /\bincome\b/]);
    const expenses = findStatementAmount(profitLoss, [/\bexpense\b/, /\bcost\b/]);
    const netIncome = findStatementAmount(profitLoss, [/net income/, /net profit/, /^profit$/]) || revenue - expenses;
    const assets = findStatementAmount(balanceSheet, [/asset/]);
    return { revenue, expenses, netIncome, assets };
  }, [balanceSheet, profitLoss]);

  const sortedQuestions = useMemo(
    () => [...questions].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [questions],
  );

  return (
    <WorkspaceShell
      service="metabase"
      eyebrow="Native Analytics"
      title="Maxed Analytics"
      description="A native reporting hub that blends firm KPIs, accounting signals, and the saved analytics catalog from Metabase without dropping the user into a separate dashboard product."
      actions={
        <button onClick={loadAnalytics} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
          Refresh analytics
        </button>
      }
      metrics={
        <>
          <WorkspaceMetric label="Managed revenue" value={loading ? '--' : formatCurrency(stats.totalRevenue || 0)} detail={`${stats.totalClients || 0} active clients`} />
          <WorkspaceMetric label="Pending invoices" value={loading ? '--' : String(stats.pendingInvoices || 0)} detail="Outstanding follow-up" />
          <WorkspaceMetric label="Saved dashboards" value={loading ? '--' : String(dashboards.length)} detail="Metabase catalog surfaced in Maxed" />
          <WorkspaceMetric label="Net income" value={loading ? '--' : formatCurrency(totals.netIncome)} detail={`Assets ${formatCurrency(totals.assets)}`} />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadAnalytics} /> : null}
      {warning ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">{warning}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.95fr,1.25fr]">
        <WorkspacePanel title="Performance snapshot" description="Key finance lines in a Maxed-native overview.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-sm font-medium text-slate-500">Revenue</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(totals.revenue)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-sm font-medium text-slate-500">Expenses</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(totals.expenses)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-sm font-medium text-slate-500">Net income</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(totals.netIncome)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-sm font-medium text-slate-500">Assets</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(totals.assets)}</p>
              </div>
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Dashboard catalog" description="Saved analytics workspaces exposed as native navigation cards.">
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : dashboards.length === 0 ? (
            <WorkspaceEmpty
              title="No saved dashboards"
              message="Metabase is connected, but no dashboards are available for this firm yet."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {dashboards.map((dashboard) => {
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <WorkspacePanel title="Selected dashboard" description="Card inventory for the currently selected analytics workspace.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : !selectedDashboard ? (
            <WorkspaceEmpty
              title="No dashboard selected"
              message="Choose a saved dashboard above to inspect its cards and question mix."
            />
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-base font-semibold text-slate-900">{selectedDashboard.name}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedDashboard.description || 'Saved dashboard overview'}</p>
              </div>
              {selectedDashboard.cards.length === 0 ? (
                <WorkspaceEmpty
                  title="No dashboard cards"
                  message="This dashboard exists, but Metabase did not return any card metadata for it."
                />
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

        <WorkspacePanel title="Question library" description="Recently updated saved questions in the analytics stack.">
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : sortedQuestions.length === 0 ? (
            <WorkspaceEmpty
              title="No saved questions"
              message="Add saved questions in Metabase and they will appear here as first-class Maxed assets."
            />
          ) : (
            <div className="space-y-3">
              {sortedQuestions.slice(0, 8).map((question) => (
                <div key={question.id} className="rounded-2xl border border-slate-200 px-4 py-3">
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
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>
    </WorkspaceShell>
  );
}
