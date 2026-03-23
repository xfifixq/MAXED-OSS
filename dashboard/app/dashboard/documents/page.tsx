'use client';

import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceMetric,
  WorkspacePanel,
  WorkspaceShell,
  WorkspaceSkeleton,
} from '@/components/WorkspaceShell';
import { apiUrl } from '@/lib/api';
import { useFirmReady } from '@/lib/useFirmReady';
import { firmFetch, serviceFetch } from '@/lib/service-client';
import {
  formatDate,
  normalizeFirmClients,
  normalizePaperlessDocuments,
  normalizePaperlessLookupOptions,
  normalizePaperlessTags,
} from '@/lib/service-adapters';

type UploadState = {
  clientId: string;
  message: string;
};

type VaultFilters = {
  search: string;
  tag: string;
  correspondent: string;
  documentType: string;
};

type MetadataDraft = {
  title: string;
  correspondent: string;
  documentType: string;
  tags: string[];
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
  const searchParams = useSearchParams();
  const preferredClientId = searchParams.get('clientId') || '';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [metadataMessage, setMetadataMessage] = useState('');
  const [filters, setFilters] = useState<VaultFilters>({
    search: '',
    tag: '',
    correspondent: '',
    documentType: '',
  });
  const [uploadState, setUploadState] = useState<UploadState>({ clientId: '', message: '' });
  const [metadataDraft, setMetadataDraft] = useState<MetadataDraft>({
    title: '',
    correspondent: '',
    documentType: '',
    tags: [],
  });
  const [clients, setClients] = useState<ReturnType<typeof normalizeFirmClients>>([]);
  const [paperlessDocuments, setPaperlessDocuments] = useState<ReturnType<typeof normalizePaperlessDocuments>>([]);
  const [paperlessTags, setPaperlessTags] = useState<ReturnType<typeof normalizePaperlessTags>>([]);
  const [paperlessCorrespondents, setPaperlessCorrespondents] = useState<ReturnType<typeof normalizePaperlessLookupOptions>>([]);
  const [paperlessDocumentTypes, setPaperlessDocumentTypes] = useState<ReturnType<typeof normalizePaperlessLookupOptions>>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');

  const loadDocuments = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');
    setWarning('');

    const query = new URLSearchParams();
    if (filters.search.trim()) query.set('search', filters.search.trim());
    if (filters.tag) query.set('tag', filters.tag);
    if (filters.correspondent) query.set('correspondent', filters.correspondent);
    if (filters.documentType) query.set('documentType', filters.documentType);

    const results = await Promise.allSettled([
      firmFetch('/clients'),
      serviceFetch(`/api/services/paperless/documents?${query.toString()}`),
      serviceFetch('/api/services/paperless/tags'),
      serviceFetch('/api/services/paperless/correspondents'),
      serviceFetch('/api/services/paperless/document-types'),
    ]);

    const [clientsResult, documentsResult, tagsResult, correspondentsResult, documentTypesResult] = results;

    if (clientsResult.status === 'fulfilled') {
      const normalizedClients = normalizeFirmClients(clientsResult.value);
      setClients(normalizedClients);
      setUploadState((current) => ({
        ...current,
        clientId: current.clientId || preferredClientId || normalizedClients[0]?.id || '',
      }));
    } else {
      setError(clientsResult.reason instanceof Error ? clientsResult.reason.message : 'Unable to load client records.');
    }

    if (documentsResult.status === 'fulfilled') {
      const docs = normalizePaperlessDocuments(documentsResult.value);
      setPaperlessDocuments(docs);
      setSelectedDocumentId((current) => {
        if (current && docs.some((document) => document.id === current)) return current;
        return docs[0]?.id || '';
      });
    } else {
      setWarning('Paperless is unavailable right now. Maxed client document records are still available below.');
      setPaperlessDocuments([]);
      setSelectedDocumentId('');
    }

    if (tagsResult.status === 'fulfilled') {
      setPaperlessTags(normalizePaperlessTags(tagsResult.value));
    } else {
      setPaperlessTags([]);
    }

    if (correspondentsResult.status === 'fulfilled') {
      setPaperlessCorrespondents(normalizePaperlessLookupOptions(correspondentsResult.value));
    } else {
      setPaperlessCorrespondents([]);
    }

    if (documentTypesResult.status === 'fulfilled') {
      setPaperlessDocumentTypes(normalizePaperlessLookupOptions(documentTypesResult.value));
    } else {
      setPaperlessDocumentTypes([]);
    }

    setLoading(false);
  }, [filters.correspondent, filters.documentType, filters.search, filters.tag, isReady, preferredClientId]);

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

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === uploadState.clientId) || null,
    [clients, uploadState.clientId],
  );

  const pendingReviewCount = localDocuments.filter((document) => /pending|review/i.test(document.status)).length;
  const selectedDocument = paperlessDocuments.find((document) => document.id === selectedDocumentId) || null;

  useEffect(() => {
    if (!selectedDocument) {
      setMetadataDraft({ title: '', correspondent: '', documentType: '', tags: [] });
      setMetadataMessage('');
      return;
    }

    setMetadataDraft({
      title: selectedDocument.title,
      correspondent: selectedDocument.correspondentId || '',
      documentType: selectedDocument.documentTypeId || '',
      tags: selectedDocument.tagIds || [],
    });
    setMetadataMessage('');
  }, [selectedDocument]);

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

  const saveMetadata = useCallback(async () => {
    if (!selectedDocument) return;

    setSavingMetadata(true);
    setMetadataMessage('');
    setError('');

    try {
      await serviceFetch(`/api/services/paperless/documents/${selectedDocument.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: metadataDraft.title,
          correspondent: metadataDraft.correspondent || null,
          document_type: metadataDraft.documentType || null,
          tags: metadataDraft.tags,
        }),
      });
      setMetadataMessage('Metadata saved.');
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save document metadata.');
    } finally {
      setSavingMetadata(false);
    }
  }, [loadDocuments, metadataDraft.correspondent, metadataDraft.documentType, metadataDraft.tags, metadataDraft.title, selectedDocument]);

  const handleUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
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
  }, [clients, firmId, loadDocuments, uploadState.clientId]);

  return (
    <WorkspaceShell
      service="paperless"
      eyebrow="Maxed Documents"
      title="Maxed Docs"
      description="A document review workspace for CPA teams. Browse the vault, filter by metadata, edit classification, preview documents, upload intake, and open synced client records inside Maxed."
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
          <WorkspaceMetric label="Vault docs" value={loading ? '--' : String(paperlessDocuments.length)} detail="Current Paperless result set" />
          <WorkspaceMetric label="Pending review" value={loading ? '--' : String(pendingReviewCount)} detail="Items awaiting team action" />
          <WorkspaceMetric label="Classifiers" value={loading ? '--' : String(paperlessTags.length + paperlessDocumentTypes.length)} detail="Tags and document types available" />
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
        <WorkspacePanel title="Upload intake" description="Attach files to a client record and sync them into the Paperless vault.">
          <div className="space-y-4">
            {selectedClient ? (
              <div className="rounded-2xl border border-brand-200 bg-brand-50/50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selectedClient.name}</p>
                    <p className="mt-1 text-sm text-slate-500">Document intake is currently scoped to this client.</p>
                  </div>
                  <Link href={`/dashboard/clients/${selectedClient.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    Open client
                  </Link>
                </div>
              </div>
            ) : null}
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
                Uploads create a Maxed client record first, then sync supporting files into the document system in the background.
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
          title="Vault filters"
          description="Narrow the Paperless repository by search, tag, correspondent, or document type."
          action={
            <button onClick={loadDocuments} className="btn-secondary">
              Apply filters
            </button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Search</label>
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search title or OCR metadata..."
                className="input mt-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Tag</label>
              <select className="input mt-2" value={filters.tag} onChange={(event) => setFilters((current) => ({ ...current, tag: event.target.value }))}>
                <option value="">All tags</option>
                {paperlessTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Correspondent</label>
              <select className="input mt-2" value={filters.correspondent} onChange={(event) => setFilters((current) => ({ ...current, correspondent: event.target.value }))}>
                <option value="">All correspondents</option>
                {paperlessCorrespondents.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Document type</label>
              <select className="input mt-2" value={filters.documentType} onChange={(event) => setFilters((current) => ({ ...current, documentType: event.target.value }))}>
                <option value="">All document types</option>
                {paperlessDocumentTypes.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => setFilters({ search: '', tag: '', correspondent: '', documentType: '' })} className="btn-secondary w-full">
                Clear filters
              </button>
            </div>
          </div>
        </WorkspacePanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <WorkspacePanel title="Vault results" description="Paperless documents returned from the current filter set.">
          {loading ? (
            <WorkspaceSkeleton rows={6} />
          ) : paperlessDocuments.length === 0 ? (
            <WorkspaceEmpty title="No vault documents returned" message="Try different filters, or confirm Paperless has documents for this firm." />
          ) : (
            <div className="space-y-3">
              {paperlessDocuments.slice(0, 12).map((document) => {
                const active = document.id === selectedDocumentId;
                return (
                  <button
                    key={document.id}
                    onClick={() => setSelectedDocumentId(document.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                      active ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">{document.title}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Added {formatDate(document.createdAt)}
                          {document.originalFileName ? ` · ${document.originalFileName}` : ''}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                        {document.documentType || 'Unsorted'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      {document.correspondent ? <span className="rounded-full bg-slate-100 px-2.5 py-1">{document.correspondent}</span> : null}
                      {document.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Document review" description="Preview the selected Paperless item and update its classification metadata.">
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : !selectedDocument ? (
            <WorkspaceEmpty title="Select a document" message="Choose a Paperless result from the left to preview the document and update its metadata." />
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <img
                  src={apiUrl(`/api/services/paperless/documents/${selectedDocument.id}/thumb`)}
                  alt={selectedDocument.title}
                  className="h-72 w-full object-contain"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Title</label>
                    <input
                      className="input mt-2"
                      value={metadataDraft.title}
                      onChange={(event) => setMetadataDraft((current) => ({ ...current, title: event.target.value }))}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Correspondent</label>
                      <select
                        className="input mt-2"
                        value={metadataDraft.correspondent}
                        onChange={(event) => setMetadataDraft((current) => ({ ...current, correspondent: event.target.value }))}
                      >
                        <option value="">No correspondent</option>
                        {paperlessCorrespondents.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Document type</label>
                      <select
                        className="input mt-2"
                        value={metadataDraft.documentType}
                        onChange={(event) => setMetadataDraft((current) => ({ ...current, documentType: event.target.value }))}
                      >
                        <option value="">No document type</option>
                        {paperlessDocumentTypes.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Tags</label>
                    <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                      {paperlessTags.map((tag) => {
                        const checked = metadataDraft.tags.includes(tag.id);
                        return (
                          <label key={tag.id} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                setMetadataDraft((current) => ({
                                  ...current,
                                  tags: event.target.checked
                                    ? [...current.tags, tag.id]
                                    : current.tags.filter((value) => value !== tag.id),
                                }))
                              }
                            />
                            <span>{tag.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Created</p>
                    <p className="mt-1 text-sm text-slate-700">{formatDate(selectedDocument.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Archive serial</p>
                    <p className="mt-1 text-sm text-slate-700">{selectedDocument.archiveSerialNumber || 'Not assigned'}</p>
                  </div>
                </div>

                {metadataMessage ? <p className="mt-4 text-sm text-emerald-700">{metadataMessage}</p> : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button onClick={saveMetadata} disabled={savingMetadata} className="btn-primary disabled:opacity-60">
                    {savingMetadata ? 'Saving metadata...' : 'Save metadata'}
                  </button>
                  <button onClick={() => downloadPaperlessDocument(selectedDocument.id, selectedDocument.title)} className="btn-secondary">
                    Download original
                  </button>
                </div>
              </div>
            </div>
          )}
        </WorkspacePanel>
      </div>

      <WorkspacePanel title="Client document activity" description="Native Maxed records used by the client portal and dashboard workflows.">
        {loading ? (
          <WorkspaceSkeleton rows={5} />
        ) : localDocuments.length === 0 ? (
          <WorkspaceEmpty title="No client documents yet" message="Upload a file above or wait for a client to send one through the portal." />
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
