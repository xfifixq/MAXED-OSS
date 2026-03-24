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
  formatDateTime,
  formatDurationMinutes,
  normalizeN8nExecutions,
  normalizeN8nWorkflows,
} from '@/lib/service-adapters';

type WorkflowsWorkspacePayload = {
  workspace?: {
    configured?: boolean;
    health?: string;
    liveProbe?: {
      reason?: string;
    };
  };
  issues?: Array<{
    operation?: string;
    reason?: string;
    status?: number;
    detail?: string;
  }>;
  data?: {
    workflows?: unknown;
    executions?: unknown;
  };
};

export default function WorkflowsPage() {
  const { isReady } = useFirmReady();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [savingId, setSavingId] = useState('');
  const [workflows, setWorkflows] = useState<ReturnType<typeof normalizeN8nWorkflows>>([]);
  const [executions, setExecutions] = useState<ReturnType<typeof normalizeN8nExecutions>>([]);

  const loadWorkflows = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');
    setWarning('');

    try {
      const payload = await firmFetch<WorkflowsWorkspacePayload>('/workspaces/workflows');
      const issue = payload.issues?.[0];
      const probeReason = payload.workspace?.liveProbe?.reason?.replace(/_/g, ' ');

      if (issue) {
        setWarning(`n8n needs repair before live workflow data is trustworthy. ${issue.operation || 'connector'} failed: ${issue.reason || 'unknown'}${issue.status ? ` (HTTP ${issue.status})` : ''}${issue.detail ? ` · ${issue.detail}` : ''}`);
      } else if (payload.workspace?.configured && payload.workspace?.health !== 'connected') {
        setWarning(`n8n is mapped in Maxed, but the live connector still needs repair: ${probeReason || 'unknown issue'}.`);
      }

      setWorkflows(normalizeN8nWorkflows(payload.data?.workflows));
      setExecutions(normalizeN8nExecutions(payload.data?.executions));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load automations.');
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const toggleWorkflow = useCallback(
    async (id: string, active: boolean) => {
      setSavingId(id);
      try {
        await firmFetch(`/workspaces/workflows/${id}/activate`, {
          method: 'POST',
          body: JSON.stringify({ active }),
        });
        await loadWorkflows();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to update workflow state.');
      } finally {
        setSavingId('');
      }
    },
    [loadWorkflows],
  );

  const activity = useMemo(() => {
    const activeCount = workflows.filter((workflow) => workflow.active).length;
    const failureCount = executions.filter((execution) => /(error|fail|crash)/.test(execution.status)).length;
    const completedCount = executions.filter((execution) => /(success|complete)/.test(execution.status)).length;
    const rate = completedCount + failureCount > 0 ? Math.round((completedCount / (completedCount + failureCount)) * 100) : 0;

    return { activeCount, failureCount, completedCount, rate };
  }, [executions, workflows]);

  return (
    <WorkspaceShell
      service="n8n"
      eyebrow="Maxed Automations"
      title="Maxed Automations"
      description="Monitor firm automations, recent execution health, and activation state from the Maxed workflow console."
      actions={
        <button onClick={loadWorkflows} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
          Refresh runs
        </button>
      }
      metrics={
        <>
          <WorkspaceMetric label="Active workflows" value={loading ? '--' : String(activity.activeCount)} detail={`${workflows.length} total automations`} />
          <WorkspaceMetric label="Successful runs" value={loading ? '--' : String(activity.completedCount)} detail={`${activity.rate}% success rate`} />
          <WorkspaceMetric label="Failures" value={loading ? '--' : String(activity.failureCount)} detail="Recent execution errors" />
          <WorkspaceMetric label="Live executions" value={loading ? '--' : String(executions.filter((execution) => execution.status === 'running').length)} detail="Currently processing" />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadWorkflows} /> : null}
      {warning ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">{warning}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <WorkspacePanel title="Workflow inventory" description="Toggle automations without leaving Maxed.">
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : workflows.length === 0 ? (
            <WorkspaceEmpty
              title="No workflows yet"
              message="Automations will appear here as soon as n8n is connected for this firm."
            />
          ) : (
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <div key={workflow.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{workflow.name}</p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            workflow.active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {workflow.active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        Updated {formatDateTime(workflow.updatedAt)}{workflow.createdAt ? ` · Created ${formatDateTime(workflow.createdAt)}` : ''}
                      </p>
                      {workflow.tags.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {workflow.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button
                      onClick={() => toggleWorkflow(workflow.id, !workflow.active)}
                      disabled={savingId === workflow.id}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                        workflow.active
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'bg-brand-600 text-white hover:bg-brand-700'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {savingId === workflow.id ? 'Saving...' : workflow.active ? 'Pause workflow' : 'Activate workflow'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Recent executions" description="Native run history with duration and status.">
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : executions.length === 0 ? (
            <WorkspaceEmpty
              title="No execution history"
              message="Run history will appear once workflows start executing."
            />
          ) : (
            <div className="space-y-3">
              {executions.map((execution) => (
                <div key={execution.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{execution.workflowName}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Started {formatDateTime(execution.startedAt)}
                        {execution.stoppedAt ? ` · Finished ${formatDateTime(execution.stoppedAt)}` : ''}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        /(success|complete)/.test(execution.status)
                          ? 'bg-emerald-100 text-emerald-700'
                          : /(error|fail|crash)/.test(execution.status)
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {execution.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span>Run ID {execution.id}</span>
                    <span>Duration {formatDurationMinutes(execution.durationMinutes)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>
    </WorkspaceShell>
  );
}
