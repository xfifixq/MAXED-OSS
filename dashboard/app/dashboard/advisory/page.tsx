'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { WorkspaceEmpty, WorkspaceError, WorkspaceMetric, WorkspacePanel, WorkspaceShell, WorkspaceSkeleton } from '@/components/WorkspaceShell';
import { useFirmReady } from '@/lib/useFirmReady';
import { firmFetch, serviceFetch } from '@/lib/service-client';
import { formatCurrency, formatDate, normalizeFirmClients } from '@/lib/service-adapters';

type Scenario = {
  id: string;
  clientId: string;
  clientName: string;
  question: string;
  optionChosen: string | null;
  projectedImpact: number | null;
  actualImpact: number | null;
  createdAt: string | null;
  resolvedAt: string | null;
};

type DraftScenario = {
  clientId: string;
  question: string;
  optionChosen: string;
  projectedImpact: string;
  actualImpact: string;
};

const EMPTY_DRAFT: DraftScenario = {
  clientId: '',
  question: '',
  optionChosen: '',
  projectedImpact: '',
  actualImpact: '',
};

export default function AdvisoryPage() {
  const { isReady } = useFirmReady();
  const searchParams = useSearchParams();
  const preferredClientId = searchParams.get('clientId') || '';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<ReturnType<typeof normalizeFirmClients>>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [draft, setDraft] = useState<DraftScenario>(EMPTY_DRAFT);

  const loadAdvisory = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');

    try {
      const clientsPayload = await firmFetch('/clients');
      const normalizedClients = normalizeFirmClients(clientsPayload);
      const nextClientId = preferredClientId || normalizedClients[0]?.id || '';

      setClients(normalizedClients);
      setSelectedClientId((current) => current || nextClientId);
      setDraft((current) => ({
        ...current,
        clientId: current.clientId || nextClientId,
      }));

      const scenarioResponses = await Promise.all(
        normalizedClients.map(async (client) => {
          try {
            const payload = await serviceFetch<unknown>(`/api/clients/${client.id}/scenarios`);
            const rows = Array.isArray(payload) ? payload : [];
            return rows.map((item) => ({
              id: String((item as { id?: unknown }).id || ''),
              clientId: client.id,
              clientName: client.name,
              question: String((item as { question?: unknown }).question || 'Scenario'),
              optionChosen: ((item as { optionChosen?: unknown }).optionChosen || null) as string | null,
              projectedImpact: Number((item as { projectedImpact?: unknown }).projectedImpact || 0),
              actualImpact: Number((item as { actualImpact?: unknown }).actualImpact || 0),
              createdAt: String((item as { createdAt?: unknown }).createdAt || '') || null,
              resolvedAt: String((item as { resolvedAt?: unknown }).resolvedAt || '') || null,
            }));
          } catch {
            return [];
          }
        }),
      );

      setScenarios(scenarioResponses.flat().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load advisory workspace.');
      setClients([]);
      setScenarios([]);
    } finally {
      setLoading(false);
    }
  }, [isReady, preferredClientId]);

  useEffect(() => {
    loadAdvisory();
  }, [loadAdvisory]);

  const filteredScenarios = useMemo(
    () => scenarios.filter((scenario) => !selectedClientId || scenario.clientId === selectedClientId),
    [scenarios, selectedClientId],
  );

  const openScenarios = useMemo(
    () => filteredScenarios.filter((scenario) => !scenario.resolvedAt),
    [filteredScenarios],
  );

  const totalProjectedImpact = useMemo(
    () => filteredScenarios.reduce((sum, scenario) => sum + (scenario.projectedImpact || 0), 0),
    [filteredScenarios],
  );

  const totalActualImpact = useMemo(
    () => filteredScenarios.reduce((sum, scenario) => sum + (scenario.actualImpact || 0), 0),
    [filteredScenarios],
  );

  const createScenario = useCallback(async () => {
    if (!draft.clientId || !draft.question.trim()) return;

    setSaving(true);
    setError('');

    try {
      await serviceFetch(`/api/clients/${draft.clientId}/scenarios`, {
        method: 'POST',
        body: JSON.stringify({
          question: draft.question.trim(),
          optionChosen: draft.optionChosen.trim() || null,
          projectedImpact: Number(draft.projectedImpact) || 0,
          actualImpact: Number(draft.actualImpact) || 0,
          resolvedAt: draft.actualImpact ? new Date().toISOString() : null,
        }),
      });

      setDraft((current) => ({
        ...EMPTY_DRAFT,
        clientId: current.clientId,
      }));
      setSelectedClientId(draft.clientId);
      await loadAdvisory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create scenario.');
    } finally {
      setSaving(false);
    }
  }, [draft, loadAdvisory]);

  return (
    <WorkspaceShell
      eyebrow="Native Advisory"
      title="Maxed Advisory"
      description="Track planning scenarios, estimated impact, and client-specific follow-up from a real Maxed workspace instead of a placeholder page."
      actions={
        <button onClick={loadAdvisory} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
          Refresh advisory
        </button>
      }
      metrics={
        <>
          <WorkspaceMetric label="Scenarios" value={loading ? '--' : String(filteredScenarios.length)} detail="Visible planning cases" />
          <WorkspaceMetric label="Open reviews" value={loading ? '--' : String(openScenarios.length)} detail="Awaiting resolution" />
          <WorkspaceMetric label="Projected impact" value={loading ? '--' : formatCurrency(totalProjectedImpact)} detail="Estimated upside" />
          <WorkspaceMetric label="Realized impact" value={loading ? '--' : formatCurrency(totalActualImpact)} detail="Closed-case result" />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadAdvisory} /> : null}

      <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <WorkspacePanel
          title="Scenario intake"
          description="Capture an advisory what-if, the recommended path, and the expected impact."
          action={
            <select className="input min-w-[14rem]" value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          }
        >
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : clients.length === 0 ? (
            <WorkspaceEmpty title="No clients available" message="Create a client record first so advisory planning can be tied to a real account." />
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Client</label>
                <select
                  className="input mt-2"
                  value={draft.clientId}
                  onChange={(event) => setDraft((current) => ({ ...current, clientId: event.target.value }))}
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Scenario question</label>
                <textarea
                  className="input mt-2 min-h-[7rem]"
                  value={draft.question}
                  onChange={(event) => setDraft((current) => ({ ...current, question: event.target.value }))}
                  placeholder="Example: Should the client change entity structure before year end?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Recommended path</label>
                <input
                  className="input mt-2"
                  value={draft.optionChosen}
                  onChange={(event) => setDraft((current) => ({ ...current, optionChosen: event.target.value }))}
                  placeholder="Example: Convert to S-Corp effective next quarter"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Projected impact
                  <input
                    className="input mt-2"
                    type="number"
                    value={draft.projectedImpact}
                    onChange={(event) => setDraft((current) => ({ ...current, projectedImpact: event.target.value }))}
                    placeholder="0"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Actual impact
                  <input
                    className="input mt-2"
                    type="number"
                    value={draft.actualImpact}
                    onChange={(event) => setDraft((current) => ({ ...current, actualImpact: event.target.value }))}
                    placeholder="Optional until resolved"
                  />
                </label>
              </div>
              <button onClick={createScenario} disabled={saving} className="btn-primary w-full disabled:opacity-60">
                {saving ? 'Saving scenario...' : 'Create scenario'}
              </button>
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Planning queue" description="Review open and resolved scenarios by client, then jump back into the full client record when needed.">
          {loading ? (
            <WorkspaceSkeleton rows={6} />
          ) : filteredScenarios.length === 0 ? (
            <WorkspaceEmpty title="No planning scenarios yet" message="Create the first advisory case to start tracking recommendations in Maxed." />
          ) : (
            <div className="space-y-3">
              {filteredScenarios.map((scenario) => (
                <div key={scenario.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{scenario.clientName}</p>
                        <span className={scenario.resolvedAt ? 'badge-green' : 'badge-blue'}>
                          {scenario.resolvedAt ? 'resolved' : 'open'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{scenario.question}</p>
                      <p className="text-sm text-slate-500">
                        {scenario.optionChosen ? `Recommendation: ${scenario.optionChosen}` : 'Recommendation pending'}
                      </p>
                    </div>
                    <Link href={`/dashboard/clients/${scenario.clientId}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                      Open client
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Projected</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(scenario.projectedImpact || 0)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Actual</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(scenario.actualImpact || 0)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Created</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(scenario.createdAt)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Resolved</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{scenario.resolvedAt ? formatDate(scenario.resolvedAt) : 'Pending'}</p>
                    </div>
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
