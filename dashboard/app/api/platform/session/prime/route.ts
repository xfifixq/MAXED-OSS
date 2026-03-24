import { NextRequest, NextResponse } from 'next/server';

const PLATFORM_API_URL =
  process.env.PLATFORM_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4100';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = (await request.json()) as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 },
      );
    }

    const res = await fetch(`${PLATFORM_API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { error: payload?.error || 'Invalid credentials' },
        { status: res.status },
      );
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: 'Platform API unreachable' },
      { status: 502 },
    );
  }
}
