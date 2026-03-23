const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const FIRM_STORAGE_KEY = 'maxed:firmId';

function readStoredFirmId(): string {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(FIRM_STORAGE_KEY) || '';
}

let _firmId = readStoredFirmId();

export function setFirmId(id: string) {
  _firmId = id;
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(FIRM_STORAGE_KEY, id);
  }
}

export function getFirmId(): string {
  if (!_firmId) {
    _firmId = readStoredFirmId();
  }
  return _firmId;
}

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export function bridgeUrl(service: string, target = ''): string {
  const firmId = getFirmId();
  const params = new URLSearchParams();
  if (firmId) params.set('firmId', firmId);
  if (target) params.set('target', target);
  return `${API_URL}/bridge/${service}?${params.toString()}`;
}

export function firmApiUrl(path: string): string {
  return `${API_URL}/api/firms/${getFirmId()}${path}`;
}

// Headers to include on all service proxy calls — tells the API which firm's credentials to use
export function serviceHeaders(): Record<string, string> {
  const firmId = getFirmId();
  return firmId ? { 'X-Firm-Id': firmId } : {};
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
