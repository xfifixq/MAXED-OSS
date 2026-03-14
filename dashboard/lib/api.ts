const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Dynamic firmId — set from session on login, defaults to '1'
let _firmId = '1';

export function setFirmId(id: string) {
  _firmId = id;
}

export function getFirmId(): string {
  return _firmId;
}

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export function firmApiUrl(path: string): string {
  return `${API_URL}/api/firms/${_firmId}${path}`;
}

// Headers to include on all service proxy calls — tells the API which firm's credentials to use
export function serviceHeaders(): Record<string, string> {
  return { 'X-Firm-Id': _firmId };
}

export async function apiFetch<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = path.startsWith('/api/firms')
    ? apiUrl(path)
    : firmApiUrl(path);

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...serviceHeaders(),
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export { _firmId as FIRM_ID };
