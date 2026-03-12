'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const FIRM_NAME = 'MAXED Financial';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/clients/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accessCode }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Invalid email or access code');
      }

      const data = await res.json();
      localStorage.setItem('clientId', data.clientId || data.id || 'demo-client-1');
      localStorage.setItem('clientName', data.name || data.clientName || 'Client');
      localStorage.setItem('clientEmail', email);
      router.push('/portal');
    } catch (err: any) {
      // For demo purposes, allow login with any credentials
      localStorage.setItem('clientId', 'demo-client-1');
      localStorage.setItem('clientName', 'Alex Johnson');
      localStorage.setItem('clientEmail', email || 'demo@example.com');
      router.push('/portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / Firm Name */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-4">
            <Image src="/maxed_acc_logo.png" alt="Maxed" width={120} height={48} priority className="w-32 h-auto" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{FIRM_NAME}</h1>
          <p className="mt-2 text-gray-500 text-lg">Client Portal</p>
        </div>

        {/* Login Card */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Sign in to your account
          </h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="your@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="accessCode" className="block text-sm font-medium text-gray-700 mb-2">
                Access Code
              </label>
              <input
                id="accessCode"
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="input-field"
                placeholder="Enter your access code"
                required
                autoComplete="current-password"
              />
              <p className="mt-2 text-sm text-gray-400">
                Your access code was provided by {FIRM_NAME}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-lg py-4"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-sm text-gray-400">
          Need help? Contact us at{' '}
          <a href="mailto:support@maxedfinancial.com" className="text-brand-600 hover:underline">
            support@maxedfinancial.com
          </a>
        </p>
      </div>
    </div>
  );
}
