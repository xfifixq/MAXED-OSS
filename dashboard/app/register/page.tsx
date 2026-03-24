'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Firm info
  const [firmName, setFirmName] = useState('');
  const [firmEmail, setFirmEmail] = useState('');
  const [firmPhone, setFirmPhone] = useState('');

  // Step 2: Admin user
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100';

  const primePlatformSession = async (userEmail: string, userPassword: string) => {
    const loginRes = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        password: userPassword,
      }),
      credentials: 'include',
    });

    if (!loginRes.ok) {
      return;
    }

    const loginPayload = (await loginRes.json().catch(() => null)) as { platformSessionToken?: string } | null;
    const token = loginPayload?.platformSessionToken;
    if (!token) {
      return;
    }

    await fetch('/api/platform/session/bootstrap', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);
  };

  const bootstrapPlatformSession = async () => {
    const res = await fetch('/api/platform/session/bootstrap', {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || 'Unable to establish secure Maxed session.');
    }
  };

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firmName || !firmEmail) {
      setError('Firm name and email are required.');
      return;
    }
    setStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (adminPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (adminPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmName,
          firmEmail,
          firmPhone,
          adminName,
          adminEmail,
          adminPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      await primePlatformSession(adminEmail, adminPassword);

      // Auto sign in after registration
      const result = await signIn('credentials', {
        email: adminEmail,
        password: adminPassword,
        redirect: false,
        callbackUrl: '/dashboard',
      });

      if (result?.ok) {
        await bootstrapPlatformSession();
        router.push('/dashboard');
      } else {
        // Registration succeeded but auto-login failed, redirect to login
        router.push('/login');
      }
    } catch {
      setError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-4">
      <div className="w-full max-w-lg">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Image src="/maxed_acc_logo.png" alt="Maxed" width={120} height={48} priority className="w-32 h-auto" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create your firm account</h1>
          <p className="text-gray-400 mt-1">
            {step === 1 ? 'Step 1 of 2: Firm details' : 'Step 2 of 2: Your admin account'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-6">
          <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-brand-500' : 'bg-white/20'}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-brand-500' : 'bg-white/20'}`} />
        </div>

        {/* Registration Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-5">
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-5">
              <div>
                <label htmlFor="firmName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Firm name
                </label>
                <input
                  id="firmName"
                  type="text"
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  className="input"
                  placeholder="Smith & Associates CPA"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="firmEmail" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Firm email
                </label>
                <input
                  id="firmEmail"
                  type="email"
                  value={firmEmail}
                  onChange={(e) => setFirmEmail(e.target.value)}
                  className="input"
                  placeholder="info@smithcpa.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="firmPhone" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone number <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  id="firmPhone"
                  type="tel"
                  value={firmPhone}
                  onChange={(e) => setFirmPhone(e.target.value)}
                  className="input"
                  placeholder="(555) 123-4567"
                />
              </div>

              <button type="submit" className="btn-primary w-full py-2.5">
                Continue
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label htmlFor="adminName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Your full name
                </label>
                <input
                  id="adminName"
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="input"
                  placeholder="John Smith"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Your email
                </label>
                <input
                  id="adminEmail"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="input"
                  placeholder="john@smithcpa.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <input
                  id="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="input"
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="Re-enter your password"
                  required
                  minLength={8}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-secondary flex-1 py-2.5"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    'Create account'
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
