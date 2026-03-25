'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.token) {
        setResetToken(data.token);
      }
      setSubmitted(true);
    } catch {
      setError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Image src="/maxed_acc_logo.png" alt="Maxed" width={120} height={48} priority className="w-32 h-auto" />
          </div>
          <h1 className="text-2xl font-bold text-white">Reset your password</h1>
          <p className="text-gray-400 mt-1">Enter your email to receive a reset link</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-50 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-700">
                If an account exists for <strong>{email}</strong>, a password reset link has been generated.
              </p>
              {resetToken && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-2">Reset link:</p>
                  <Link
                    href={`/reset-password?token=${resetToken}`}
                    className="text-brand-600 hover:text-brand-700 font-medium text-sm break-all"
                  >
                    Click here to reset your password
                  </Link>
                </div>
              )}
              <Link href="/login" className="block text-sm text-brand-600 hover:text-brand-700 font-medium mt-4">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-5">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="your@email.com"
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
              <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                <Link href="/login" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
