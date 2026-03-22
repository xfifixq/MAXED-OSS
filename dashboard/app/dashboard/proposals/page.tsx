'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const preferredClientId = searchParams.get('clientId') || '';
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [clients, setClients] = useState<ReturnType<typeof normalizeFirmClients>>([]);
  const [templates, setTemplates] = useState<ReturnType<typeof normalizeDocuSealTemplates>>([]);
  const [submissions, setSubmissions] = useState<ReturnType<typeof normalizeDocuSealSubmissions>>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('');
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
      const normalizedSubmissions = normalizeDocuSealSubmissions(submissionsPayload);

      setClients(normalizedClients);
      setTemplates(normalizedTemplates);
      setSubmissions(normalizedSubmissions);
      setSelectedSubmissionId((current) => current || normalizedSubmissions[0]?.id || '');
      const nextClientId = preferredClientId || normalizedClients[0]?.id || '';
      setDraft((current) => ({
        clientId: current.clientId || nextClientId,
        templateId: current.templateId || normalizedTemplates[0]?.id || '',
        role: current.role || normalizedTemplates[0]?.roles[0] || 'Signer',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load proposal data.');
    } finally {
      setLoading(false);
    }
  }, [isReady, preferredClientId]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === draft.templateId) || null,
    [draft.templateId, templates],
  );

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === draft.clientId) || null,
    [clients, draft.clientId],
  );

  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((template) => template.name.toLowerCase().includes(query));
  }, [templateSearch, templates]);

  const filteredSubmissions = useMemo(() => {
    const query = submissionSearch.trim().toLowerCase();
    if (!query) return submissions;
    return submissions.filter((submission) =>
      [submission.title, submission.status, submission.submitters.map((submitter) => `${submitter.name} ${submitter.email}`).join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [submissionSearch, submissions]);

  const selectedSubmission = useMemo(
    () => submissions.find((submission) => submission.id === selectedSubmissionId) || null,
    [selectedSubmissionId, submissions],
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
            <WorkspaceEmpty title="Missing templates or clients" message="Add DocuSeal templates and at least one client record before sending a proposal." />
          ) : (
            <div className="space-y-4">
              {selectedClient ? (
                <div className="rounded-2xl border border-brand-200 bg-brand-50/50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selectedClient.name}</p>
                      <p className="mt-1 text-sm text-slate-500">Proposal delivery is currently scoped to this client.</p>
                    </div>
                    <Link href={`/dashboard/clients/${selectedClient.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                      Open client
                    </Link>
                  </div>
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-medium text-slate-700">Client</label>
                <select className="input mt-2" value={draft.clientId} onChange={(event) => setDraft((current) => ({ ...current, clientId: event.target.value }))}>
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

        <WorkspacePanel
          title="Template library"
          description="DocuSeal templates exposed as Maxed-native cards."
          action={
            <input
              value={templateSearch}
              onChange={(event) => setTemplateSearch(event.target.value)}
              className="input min-w-[16rem]"
              placeholder="Search templates..."
            />
          }
        >
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : filteredTemplates.length === 0 ? (
            <WorkspaceEmpty title="No templates found" message="Create or import DocuSeal templates and they will appear here." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredTemplates.map((template) => (
                <div key={template.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <p className="font-semibold text-slate-900">{template.name}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {template.documents || 0} document{template.documents === 1 ? '' : 's'} · {template.fields || 0} mapped field{template.fields === 1 ? '' : 's'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {template.roles.length ? `Roles: ${template.roles.join(', ')}` : 'No signer roles returned'}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">Updated {formatDate(template.updatedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
        <WorkspacePanel
          title="Submission queue"
          description="Search open and completed proposal packets."
          action={
            <input
              value={submissionSearch}
              onChange={(event) => setSubmissionSearch(event.target.value)}
              className="input min-w-[16rem]"
              placeholder="Search submissions..."
            />
          }
        >
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : filteredSubmissions.length === 0 ? (
            <WorkspaceEmpty title="No submissions found" message="Send a proposal or change the search to see submission history." />
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.slice(0, 12).map((submission) => {
                const active = submission.id === selectedSubmissionId;
                const completed = /(complete|signed)/.test(submission.status);

                return (
                  <button
                    key={submission.id}
                    onClick={() => setSelectedSubmissionId(submission.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                      active ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{submission.title}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {submission.submitters.map((submitter) => submitter.email || submitter.name).filter(Boolean).join(', ') || 'No submitters returned'}
                        </p>
                        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">Sent {formatDate(submission.createdAt)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {submission.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Submission detail" description="Inspect signer coverage and status for the selected engagement packet.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : !selectedSubmission ? (
            <WorkspaceEmpty title="No submission selected" message="Choose a proposal packet from the left to review signer coverage and status." />
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-base font-semibold text-slate-900">{selectedSubmission.title}</p>
                <p className="mt-1 text-sm text-slate-500">Created {formatDate(selectedSubmission.createdAt)}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">Status</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{selectedSubmission.status}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Signer roster</p>
                {selectedSubmission.submitters.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No submitter metadata was returned for this packet.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {selectedSubmission.submitters.map((submitter, index) => (
                      <div key={`${submitter.email}-${index}`} className="rounded-2xl border border-slate-200 px-4 py-3">
                        <p className="font-medium text-slate-900">{submitter.name || submitter.email || 'Signer'}</p>
                        <p className="mt-1 text-sm text-slate-500">{submitter.email || 'No email returned'}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">{submitter.role || 'Signer'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-medium text-slate-500">Open packets</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{pendingSubmissions.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-medium text-slate-500">Completed packets</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{completedSubmissions.length}</p>
                </div>
              </div>
            </div>
          )}
        </WorkspacePanel>
      </div>
    </WorkspaceShell>
  );
}
