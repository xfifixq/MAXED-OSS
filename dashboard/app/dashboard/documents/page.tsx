'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiUrl, serviceHeaders } from '@/lib/api';
import { useFirmReady } from '@/lib/useFirmReady';

interface PaperlessTag {
  id: number;
  name: string;
  colour: number;
}

interface PaperlessDocument {
  id: number;
  title: string;
  created: string;
  added: string;
  correspondent: number | null;
  document_type: number | null;
  tags: number[];
}

const PLACEHOLDER_DOCS: PaperlessDocument[] = [
  { id: 1, title: '2025 Q4 Tax Return - Acme Corp', created: '2026-01-15T10:30:00Z', added: '2026-01-15T10:32:00Z', correspondent: 1, document_type: 1, tags: [1, 3] },
  { id: 2, title: 'W-2 Forms - TechStart Inc', created: '2026-02-01T08:00:00Z', added: '2026-02-01T08:05:00Z', correspondent: 2, document_type: 2, tags: [2] },
  { id: 3, title: 'Bank Statement - Baker & Associates', created: '2026-02-10T14:20:00Z', added: '2026-02-10T14:22:00Z', correspondent: 3, document_type: 3, tags: [1] },
  { id: 4, title: '1099-NEC - Summit Partners', created: '2026-02-28T09:15:00Z', added: '2026-02-28T09:18:00Z', correspondent: 4, document_type: 2, tags: [2, 3] },
  { id: 5, title: 'Engagement Letter - GreenLeaf Organic', created: '2026-03-05T11:45:00Z', added: '2026-03-05T11:48:00Z', correspondent: 5, document_type: 4, tags: [4] },
];

const PLACEHOLDER_TAGS: PaperlessTag[] = [
  { id: 1, name: 'Tax', colour: 1 },
  { id: 2, name: 'Payroll', colour: 2 },
  { id: 3, name: 'Corporate', colour: 3 },
  { id: 4, name: 'Engagement', colour: 4 },
];

const TAG_BADGE_CLASSES: Record<number, string> = {
  1: 'badge-green',
  2: 'badge-blue',
  3: 'badge-yellow',
  4: 'badge-purple',
};

function tagBadgeClass(colour: number): string {
  return TAG_BADGE_CLASSES[colour] || 'badge-blue';
}

const PAGE_SIZE = 25;

export default function DocumentsPage() {
  const { isReady } = useFirmReady();
  const [documents, setDocuments] = useState<PaperlessDocument[]>([]);
  const [tags, setTags] = useState<PaperlessTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [usingPlaceholder, setUsingPlaceholder] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchDocuments = useCallback(async (currentPage: number, query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(currentPage) });
      if (query.trim()) {
        params.set('search', query.trim());
      }
      const res = await fetch(apiUrl(`/api/services/paperless/documents?${params.toString()}`), { headers: serviceHeaders() });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setDocuments(data.results || []);
      setTotalCount(data.count || 0);
      setUsingPlaceholder(false);
    } catch {
      setDocuments(PLACEHOLDER_DOCS);
      setTotalCount(PLACEHOLDER_DOCS.length);
      setUsingPlaceholder(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/services/paperless/tags'), { headers: serviceHeaders() });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setTags(data.results || []);
    } catch {
      setTags(PLACEHOLDER_TAGS);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    fetchTags();
  }, [fetchTags, isReady]);

  useEffect(() => {
    if (!isReady) return;
    fetchDocuments(page, search);
  }, [page, search, fetchDocuments, isReady]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setPage(1);
    setSearch('');
  };

  const getTagName = (tagId: number): PaperlessTag | undefined => {
    return tags.find((t) => t.id === tagId);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your firm&apos;s documents</p>
        </div>
        {usingPlaceholder && (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 font-medium">
            Showing sample data — Paperless-ngx unavailable
          </span>
        )}
      </div>

      {/* Search */}
      <div className="card p-4">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search documents by title..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input pl-9"
            />
          </div>
          <button type="submit" className="btn-primary">
            Search
          </button>
          {search && (
            <button type="button" onClick={handleClearSearch} className="btn-secondary">
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Document Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Title</th>
                <th className="table-header">Created</th>
                <th className="table-header">Tags</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="table-cell">
                      <div className="skeleton h-4 w-64" />
                    </td>
                    <td className="table-cell">
                      <div className="skeleton h-4 w-24" />
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1.5">
                        <div className="skeleton h-5 w-14 rounded-full" />
                        <div className="skeleton h-5 w-16 rounded-full" />
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="skeleton h-4 w-20" />
                    </td>
                  </tr>
                ))
              ) : documents.length > 0 ? (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-brand-50 text-brand-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900">{doc.title}</span>
                      </div>
                    </td>
                    <td className="table-cell text-gray-500">{formatDate(doc.created)}</td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        {doc.tags.length > 0 ? (
                          doc.tags.map((tagId) => {
                            const tag = getTagName(tagId);
                            return tag ? (
                              <span key={tagId} className={tagBadgeClass(tag.colour)}>
                                {tag.name}
                              </span>
                            ) : (
                              <span key={tagId} className="badge-blue">
                                Tag {tagId}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-gray-400">No tags</span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <a
                        href={apiUrl(`/api/services/paperless/documents/${doc.id}/thumb`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                      >
                        Preview
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">No documents found</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {search
                            ? 'Try adjusting your search terms'
                            : 'Upload documents through Paperless-ngx to see them here'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing page <span className="font-medium">{page}</span> of{' '}
              <span className="font-medium">{totalPages}</span>
              <span className="ml-2 text-gray-400">({totalCount} documents)</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
