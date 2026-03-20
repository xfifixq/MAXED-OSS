'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorkspaceEmpty, WorkspaceError, WorkspaceMetric, WorkspacePanel, WorkspaceShell, WorkspaceSkeleton } from '@/components/WorkspaceShell';
import { useFirmReady } from '@/lib/useFirmReady';
import { firmFetch, serviceFetch } from '@/lib/service-client';
import {
  formatDate,
  normalizeDocuSealSubmissions,
  normalizeDocuSealTemplates,
  normalizeFirmClients,
} from '@/lib/service-adapters';

type DraftState = {
  clientId: string;
  templateId: string;
  role: string;
};

export default function ProposalsPage() {
  const { isReady } = useFirmReady();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<ReturnType<typeof normalizeFirmClients>>([]);
  const [templates, setTemplates] = useState<ReturnType<typeof normalizeDocuSealTemplates>>([]);
  const [submissions, setSubmissions] = useState<ReturnType<typeof normalizeDocuSealSubmissions>>([]);
  const [draft, setDraft] = useState<DraftState>({ clientId: '', templateId: '', role: '' });

  const loadProposals = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');

    try {
      const [clientsPayload, templatesPayload, submissionsPayload] = await Promise.all([
        firmFetch('/clients'),
        serviceFetch('/api/services/docuseal/templates'),
        serviceFetch('/api/services/docuseal/submissions'),
      ]);

      const normalizedClients = normalizeFirmClients(clientsPayload);
      const normalizedTemplates = normalizeDocuSealTemplates(templatesPayload);

      setClients(normalizedClients);
      setTemplates(normalizedTemplates);
      setSubmissions(normalizeDocuSealSubmissions(submissionsPayload));
      setDraft((current) => ({
        clientId: current.clientId || normalizedClients[0]?.id || '',
        templateId: current.templateId || normalizedTemplates[0]?.id || '',
        role: current.role || normalizedTemplates[0]?.roles[0] || 'Signer',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load proposal data.');
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === draft.templateId) || null,
    [draft.templateId, templates],
  );

  const pendingSubmissions = useMemo(
    () => submissions.filter((submission) => !/(complete|signed)/.test(submission.status)),
    [submissions],
  );

  const completedSubmissions = useMemo(
    () => submissions.filter((submission) => /(complete|signed)/.test(submission.status)),
    [submissions],
  );

  const sendProposal = useCallback(async () => {
    const client = clients.find((entry) => entry.id === draft.clientId);
    const template = templates.find((entry) => entry.id === draft.templateId);
    if (!client || !template) return;

    setSending(true);
    setError('');

    try {
      await serviceFetch('/api/services/docuseal/submissions', {
        method: 'POST',
        body: JSON.stringify({
          template_id: Number(template.id) || template.id,
          send_email: true,
          submitters: [
            {
              role: draft.role || template.roles[0] || 'Signer',
              name: client.name,
              email: client.email,
            },
          ],
        }),
      });

      await loadProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create proposal submission.');
    } finally {
      setSending(false);
    }
  }, [clients, draft.clientId, draft.role, draft.templateId, loadProposals, templates]);

  return (
    <WorkspaceShell
      service="docuseal"
      eyebrow="Native Proposals"
      title="Maxed Sign"
      description="Send engagement letters and proposal packets from a native Maxed workspace backed by DocuSeal templates and submission APIs."
      actions={
        <button onClick={loadProposals} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
          Refresh proposals
        </button>
      }
      metrics={
        <>
          <WorkspaceMetric label="Templates" value={loading ? '--' : String(templates.length)} detail="Reusable proposal packets" />
          <WorkspaceMetric label="Awaiting signature" value={loading ? '--' : String(pendingSubmissions.length)} detail="Open submissions" />
          <WorkspaceMetric label="Completed" value={loading ? '--' : String(completedSubmissions.length)} detail="Signed proposal history" />
          <WorkspaceMetric label="Clients ready" value={loading ? '--' : String(clients.filter((client) => client.email).length)} detail="Have a delivery email" />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadProposals} /> : null}

      <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <WorkspacePanel title="Send a proposal" description="Pick a template, target client, and signer role.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : templates.length === 0 || clients.length === 0 ? (
            <WorkspaceEmpty
              title="Missing templates or clients"
              message="Add DocuSeal templates and at least one client record before sending a proposal."
            />
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
                      {client.name} ({client.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Template</label>
                <select
                  className="input mt-2"
                  value={draft.templateId}
                  onChange={(event) => {
                    const template = templates.find((entry) => entry.id === event.target.value);
                    setDraft((current) => ({
                      ...current,
                      templateId: event.target.value,
                      role: template?.roles[0] || current.role || 'Signer',
                    }));
                  }}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Signer role</label>
                <input
                  className="input mt-2"
                  value={draft.role}
                  onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}
                  placeholder="Signer"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {selectedTemplate?.roles.length
                    ? `Template roles: ${selectedTemplate.roles.join(', ')}`
                    : 'If the template expects a specific role, set it here before sending.'}
                </p>
              </div>
              <button onClick={sendProposal} disabled={sending} className="btn-primary w-full disabled:opacity-60">
                {sending ? 'Sending proposal...' : 'Send proposal'}
              </button>
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Template library" description="DocuSeal templates exposed as Maxed-native cards.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : templates.length === 0 ? (
            <WorkspaceEmpty
              title="No templates found"
              message="Create or import DocuSeal templates and they will appear here."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((template) => (
                <div key={template.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <p className="font-semibold text-slate-900">{template.name}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {template.documents || 0} document{template.documents === 1 ? '' : 's'} · {template.fields || 0} mapped field{template.fields === 1 ? '' : 's'}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">Updated {formatDate(template.updatedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <WorkspacePanel title="Awaiting signature" description="Open proposal packets that still need client action.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : pendingSubmissions.length === 0 ? (
            <WorkspaceEmpty
              title="No pending signatures"
              message="Once a proposal is sent, it will stay here until the client completes the signing flow."
            />
          ) : (
            <div className="space-y-3">
              {pendingSubmissions.map((submission) => (
                <div key={submission.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{submission.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {submission.submitters.map((submitter) => submitter.email || submitter.name).filter(Boolean).join(', ') || 'No submitters returned'}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">Sent {formatDate(submission.createdAt)}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                      {submission.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Completed proposals" description="Signed or completed submission history.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : completedSubmissions.length === 0 ? (
            <WorkspaceEmpty
              title="No completed proposals"
              message="Signed engagement documents will appear here for quick reference."
            />
          ) : (
            <div className="space-y-3">
              {completedSubmissions.slice(0, 8).map((submission) => (
                <div key={submission.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{submission.title}</p>
                      <p className="mt-1 text-sm text-slate-500">Completed {formatDate(submission.completedAt || submission.updatedAt)}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      {submission.status}
                    </span>
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
