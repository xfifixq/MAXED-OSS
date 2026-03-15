'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
interface Question {
  id: string;
  question: string;
  response?: string;
  status: string;
  createdAt: string;
  respondedAt?: string;
}

export default function AskPage() {
  const [question, setQuestion] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [firmName, setFirmName] = useState('Maxed');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const storedFirmName = localStorage.getItem('firmName');
    if (storedFirmName) setFirmName(storedFirmName);
    fetchQuestions();
  }, []);

  async function fetchQuestions() {
    const clientId = localStorage.getItem('clientId');
    if (!clientId) return;

    try {
      const res = await fetch(`${API_URL}/api/clients/${clientId}/scenarios`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(Array.isArray(data) ? data : data.scenarios || []);
      }
    } catch {
      // API unavailable
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    const clientId = localStorage.getItem('clientId');
    const clientName = localStorage.getItem('clientName') || 'Client';
    if (!clientId) return;

    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/clients/${clientId}/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          clientName,
          type: 'client_question',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setQuestions((prev) => [data, ...prev]);
      }
    } catch {
      // Optimistically add locally
      const optimistic: Question = {
        id: `local-${Date.now()}`,
        question: question.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      setQuestions((prev) => [optimistic, ...prev]);
    } finally {
      setQuestion('');
      setSubmitting(false);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 5000);
    }
  }

  function getStatusBadge(status: string) {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Pending' },
      in_progress: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Being Reviewed' },
      answered: { bg: 'bg-green-50', text: 'text-green-700', label: 'Answered' },
      completed: { bg: 'bg-green-50', text: 'text-green-700', label: 'Answered' },
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
      <div>
        <h1 className="page-title">Ask a Question</h1>
        <p className="mt-1 text-gray-500">
          Have a financial question? Send it to your {firmName} team.
        </p>
      </div>

      {/* Question Form */}
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
              Your Question
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              className="input-field resize-none"
              placeholder="e.g., What would be the tax impact if I purchase new equipment this quarter?"
              disabled={submitting}
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={submitting || !question.trim()}
              className="btn-primary"
            >
              {submitting ? 'Sending...' : 'Send Question'}
            </button>
          </div>
        </form>

        {/* Success Message */}
        {submitted && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-700 font-medium">
                Your question has been sent to {firmName}
              </p>
            </div>
            <p className="text-green-600 text-sm mt-1 ml-8">
              We&apos;ll review it and get back to you as soon as possible.
            </p>
          </div>
        )}
      </div>

      {/* Previous Questions */}
      <div>
        <h2 className="section-label mb-4">Previous Questions</h2>

        {loading ? (
          <div className="card text-center py-12 text-gray-400">Loading...</div>
        ) : questions.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500">No questions yet. Ask your first question above!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="card">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <p className="font-medium text-gray-900">{q.question}</p>
                  {getStatusBadge(q.status)}
                </div>

                {q.response && (
                  <div className="mt-3 p-4 bg-brand-50 border border-brand-100 rounded-lg">
                    <p className="text-sm font-medium text-brand-700 mb-1">Response from {firmName}:</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{q.response}</p>
                  </div>
                )}

                <p className="text-sm text-gray-400 mt-3">
                  Asked on {new Date(q.createdAt).toLocaleDateString()}
                  {q.respondedAt && (
                    <> &middot; Answered on {new Date(q.respondedAt).toLocaleDateString()}</>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
