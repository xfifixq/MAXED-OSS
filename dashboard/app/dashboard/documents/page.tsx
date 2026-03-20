'use client';

import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WorkspaceEmpty, WorkspaceError, WorkspaceMetric, WorkspacePanel, WorkspaceShell, WorkspaceSkeleton } from '@/components/WorkspaceShell';
import { apiUrl } from '@/lib/api';
import { useFirmReady } from '@/lib/useFirmReady';
import { firmFetch, serviceFetch } from '@/lib/service-client';
import { formatDate, normalizeFirmClients, normalizePaperlessDocuments, normalizePaperlessTags } from '@/lib/service-adapters';

type UploadState = {
  clientId: string;
  message: string;
};

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unable to read file.'));
        return;
      }
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

export default function DocumentsPage() {
  const { firmId, isReady } = useFirmReady();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [search, setSearch] = useState('');
  const [uploadState, setUploadState] = useState<UploadState>({ clientId: '', message: '' });
  const [clients, setClients] = useState<ReturnType<typeof normalizeFirmClients>>([]);
  const [paperlessDocuments, setPaperlessDocuments] = useState<ReturnType<typeof normalizePaperlessDocuments>>([]);
  const [paperlessTags, setPaperlessTags] = useState<ReturnType<typeof normalizePaperlessTags>>([]);

  const loadDocuments = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');
    setWarning('');

    const results = await Promise.allSettled([
      firmFetch('/clients'),
      serviceFetch(`/api/services/paperless/documents?search=${encodeURIComponent(search)}`),
      serviceFetch('/api/services/paperless/tags'),
    ]);

    const [clientsResult, documentsResult, tagsResult] = results;

    if (clientsResult.status === 'fulfilled') {
      const normalizedClients = normalizeFirmClients(clientsResult.value);
      setClients(normalizedClients);
      setUploadState((current) => ({
        ...current,
        clientId: current.clientId || normalizedClients[0]?.id || '',
      }));
    } else {
      setError(clientsResult.reason instanceof Error ? clientsResult.reason.message : 'Unable to load client records.');
    }

    if (documentsResult.status === 'fulfilled') {
      setPaperlessDocuments(normalizePaperlessDocuments(documentsResult.value));
    } else {
      setWarning('Paperless is unavailable right now. Maxed client document records are still available below.');
      setPaperlessDocuments([]);
    }

    if (tagsResult.status === 'fulfilled') {
      setPaperlessTags(normalizePaperlessTags(tagsResult.value));
    } else {
      setPaperlessTags([]);
    }

    setLoading(false);
  }, [isReady, search]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const localDocuments = useMemo(
    () =>
      clients
        .flatMap((client) =>
          client.documents.map((document) => ({
            ...document,
            clientId: client.id,
            clientName: client.name,
          })),
        )
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [clients],
  );

  const pendingReviewCount = localDocuments.filter((document) => /pending|review/i.test(document.status)).length;

  const downloadPaperlessDocument = useCallback(async (documentId: string, title: string) => {
    try {
      const res = await fetch(apiUrl(`/api/services/paperless/documents/${documentId}/download`), {
        headers: firmId ? { 'X-Firm-Id': firmId } : {},
      });
      if (!res.ok) throw new Error(`Unable to download ${title}.`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = title || 'document';
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download document.');
    }
  }, [firmId]);

  const openStoredDocument = useCallback(async (path: string) => {
    try {
      const res = await fetch(apiUrl(`/api/storage/url?path=${encodeURIComponent(path)}`));
      if (!res.ok) throw new Error('Unable to open file.');
      const data = (await res.json()) as { url?: string };
      if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open file.');
    }
  }, []);

  const handleUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files?.length || !uploadState.clientId || !firmId) return;

      const client = clients.find((entry) => entry.id === uploadState.clientId);
      if (!client) return;

      setUploading(true);
      setUploadState((current) => ({ ...current, message: '' }));
      let partialSyncFailure = false;

      try {
        for (const file of Array.from(files)) {
          const base64Data = await toBase64(file);
          const storagePath = `dashboard/${firmId}/${client.id}/${Date.now()}-${file.name}`;

          await serviceFetch('/api/storage/upload', {
            method: 'POST',
            body: JSON.stringify({
              bucket: 'documents',
              path: storagePath,
              base64Data,
              contentType: file.type || 'application/octet-stream',
            }),
          });

          await serviceFetch(`/api/clients/${client.id}/documents`, {
            method: 'POST',
            body: JSON.stringify({
              title: file.name,
              type: file.type || 'Document',
              status: 'uploaded',
              paperlessDocId: storagePath,
            }),
          });

          try {
            await serviceFetch('/api/services/paperless/documents/upload', {
              method: 'POST',
              body: JSON.stringify({
                filename: file.name,
                base64Data,
                contentType: file.type || 'application/octet-stream',
                title: file.name,
                tags: client.paperlessTag ? [client.paperlessTag] : [],
              }),
            });
          } catch {
            partialSyncFailure = true;
          }
        }

        setUploadState((current) => ({
          ...current,
          message: partialSyncFailure
            ? 'Files were added to Maxed, but Paperless sync needs attention.'
            : 'Files uploaded to Maxed and sent to the document vault.',
        }));
        await loadDocuments();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to upload files.');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [clients, firmId, loadDocuments, uploadState.clientId],
  );

  return (
    <WorkspaceShell
      service="paperless"
      eyebrow="Native Documents"
      title="Maxed Docs"
      description="A unified document workspace for client records and the Paperless vault. Uploads, review queues, and repository search now live in the Maxed shell instead of inside an embedded document manager."
      actions={
        <>
          <button onClick={loadDocuments} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
            Refresh documents
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="btn-primary">
            {uploading ? 'Uploading...' : 'Upload files'}
          </button>
        </>
      }
      metrics={
        <>
          <WorkspaceMetric label="Client records" value={loading ? '--' : String(localDocuments.length)} detail="Documents stored in Maxed" />
          <WorkspaceMetric label="Vault docs" value={loading ? '--' : String(paperlessDocuments.length)} detail="Paperless repository items" />
          <WorkspaceMetric label="Pending review" value={loading ? '--' : String(pendingReviewCount)} detail="Items awaiting team action" />
          <WorkspaceMetric label="Tags" value={loading ? '--' : String(paperlessTags.length)} detail="Paperless classification coverage" />
        </>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUpload}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.txt"
      />

      {error ? <WorkspaceError message={error} onRetry={loadDocuments} /> : null}
      {warning ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">{warning}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <WorkspacePanel title="Upload intake" description="Attach files to a client record and sync them into the document vault.">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Assign to client</label>
              <select
                className="input mt-2"
                value={uploadState.clientId}
                onChange={(event) => setUploadState((current) => ({ ...current, clientId: event.target.value }))}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-5">
              <p className="font-medium text-slate-900">Drop files into Maxed</p>
              <p className="mt-1 text-sm text-slate-500">
                Uploads create a native Maxed client record first, then attempt a Paperless sync in the background.
              </p>
              <button onClick={() => fileInputRef.current?.click()} className="btn-primary mt-4">
                Choose files
              </button>
            </div>
            {uploadState.message ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {uploadState.message}
              </div>
            ) : null}
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          title="Vault search"
          description="Search Paperless documents by title or OCR metadata without leaving Maxed."
          action={
            <button onClick={loadDocuments} className="btn-secondary">
              Apply search
            </button>
          }
        >
          <div className="mb-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the document vault..."
              className="input"
            />
          </div>
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : paperlessDocuments.length === 0 ? (
            <WorkspaceEmpty
              title="No vault documents returned"
              message="Try a different search, or confirm Paperless has documents for this firm."
            />
          ) : (
            <div className="space-y-3">
              {paperlessDocuments.slice(0, 8).map((document) => (
                <div key={document.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{document.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        {document.documentType ? <span className="rounded-full bg-slate-100 px-2.5 py-1">{document.documentType}</span> : null}
                        {document.correspondent ? <span className="rounded-full bg-slate-100 px-2.5 py-1">{document.correspondent}</span> : null}
                        {document.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-sm text-slate-500">
                        Added {formatDate(document.createdAt)}{document.originalFileName ? ` · ${document.originalFileName}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadPaperlessDocument(document.id, document.title)}
                      className="btn-secondary"
                    >
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>

      <WorkspacePanel title="Client document activity" description="Native Maxed records used by the client portal and dashboard workflows.">
        {loading ? (
          <WorkspaceSkeleton rows={5} />
        ) : localDocuments.length === 0 ? (
          <WorkspaceEmpty
            title="No client documents yet"
            message="Upload a file above or wait for a client to send one through the portal."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-header">Document</th>
                    <th className="table-header">Client</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Created</th>
                    <th className="table-header text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {localDocuments.slice(0, 12).map((document) => (
                    <tr key={document.id} className="hover:bg-slate-50">
                      <td className="table-cell">
                        <div>
                          <p className="font-medium text-slate-900">{document.title}</p>
                          <p className="text-xs text-slate-400">{document.type}</p>
                        </div>
                      </td>
                      <td className="table-cell text-slate-500">{document.clientName}</td>
                      <td className="table-cell">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {document.status}
                        </span>
                      </td>
                      <td className="table-cell text-slate-500">{formatDate(document.createdAt)}</td>
                      <td className="table-cell text-right">
                        {document.paperlessDocId ? (
                          <button onClick={() => openStoredDocument(document.paperlessDocId as string)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                            Open
                          </button>
                        ) : (
                          <span className="text-sm text-slate-400">No file</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </WorkspacePanel>
    </WorkspaceShell>
  );
}
