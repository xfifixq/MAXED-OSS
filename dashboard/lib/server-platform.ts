type LoginPayload = {
  id: string;
  email: string;
  name: string;
  role: string;
  firmId: string;
  firmName: string;
  isPlatformAdmin?: boolean;
  platformSessionToken?: string;
  platformSessionExpiresAt?: string;
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function getPlatformGatewayUrl() {
  return (
    process.env.PLATFORM_API_URL ||
    process.env.MAXED_GATEWAY_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:4100'
  ).replace(/\/$/, '');
}

export function getPlatformAuthUrls() {
  return unique([
    process.env.PLATFORM_AUTH_URL || '',
    process.env.MAXED_AUTH_INTERNAL_URL || '',
    process.env.PLATFORM_API_URL || '',
    process.env.MAXED_GATEWAY_INTERNAL_URL || '',
    process.env.NEXT_PUBLIC_API_URL || '',
    'http://127.0.0.1:4101',
    'http://127.0.0.1:4100',
  ]).map((value) => value.replace(/\/$/, ''));
}

export async function postPlatformLogin(email: string, password: string) {
  const candidates = getPlatformAuthUrls();
  let lastError: unknown = null;
  let lastResponse: Response | null = null;

  for (const baseUrl of candidates) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const payload = (await response.json()) as LoginPayload;
        return { ok: true as const, response, payload, baseUrl };
      }

      lastResponse = response;
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ok: false as const,
    response: lastResponse,
    error: lastError,
  };
}
