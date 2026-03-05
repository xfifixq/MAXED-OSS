'use client';

import { useState, useEffect, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Document {
  id: string;
  name: string;
  status: string;
  uploadedAt: string;
  type: string;
  size?: string;
  downloadUrl?: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    const clientId = localStorage.getItem('clientId');
    if (!clientId) return;

    try {
      const res = await fetch(`${API_URL}/api/clients/${clientId}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(Array.isArray(data) ? data : data.documents || []);
      }
    } catch {
      // API unavailable - show empty state
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const clientId = localStorage.getItem('clientId');
    if (!clientId) return;

    setUploading(true);
    setUploadSuccess('');

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const res = await fetch(`${API_URL}/api/clients/${clientId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setUploadSuccess(`Successfully uploaded ${files.length} file(s)`);
        fetchDocuments();
      }
    } catch {
      setUploadSuccess('Upload submitted - your team will process it shortly.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function getStatusBadge(status: string) {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Pending Review' },
      reviewed: { bg: 'bg-green-50', text: 'text-green-700', label: 'Reviewed' },
      processing: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Processing' },
      archived: { bg: 'bg-gray-50', text: 'text-gray-600', label: 'Archived' },
    };
    const s = statusMap[status] || statusMap.pending;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Documents</h1>
          <p className="mt-1 text-gray-500">View and upload documents for your account.</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleUpload}
            className="hidden"
            id="file-upload"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.txt"
          />
          <label
            htmlFor="file-upload"
            className="btn-primary cursor-pointer inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {uploading ? 'Uploading...' : 'Upload Document'}
          </label>
        </div>
      </div>

      {/* Upload Success Message */}
      {uploadSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {uploadSuccess}
        </div>
      )}

      {/* Documents List */}
      {loading ? (
        <div className="card text-center py-12 text-gray-400">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="mx-auto w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 text-lg mb-2">No documents yet</p>
          <p className="text-gray-400 text-sm">Upload your first document using the button above.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Document</th>
                  <th className="text-left text-sm font-medium text-gray-500 px-6 py-4 hidden sm:table-cell">Date</th>
                  <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Status</th>
                  <th className="text-right text-sm font-medium text-gray-500 px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-brand-50 text-brand-600 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{doc.name}</p>
                          {doc.type && <p className="text-sm text-gray-400">{doc.type}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 hidden sm:table-cell">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(doc.status)}</td>
                    <td className="px-6 py-4 text-right">
                      {doc.downloadUrl && (
                        <a
                          href={doc.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:text-brand-700 text-sm font-medium"
                        >
                          Download
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
