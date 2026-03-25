import { NextRequest, NextResponse } from 'next/server';
import { postPlatformLogin } from '@/lib/server-platform';

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

    const result = await postPlatformLogin(email, password);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: result.response?.status || 502 },
      );
    }

    return NextResponse.json(result.payload);
  } catch {
    return NextResponse.json(
      { error: 'Platform API unreachable' },
      { status: 502 },
    );
  }
}
