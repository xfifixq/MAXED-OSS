const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100';
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

export function bridgeUrl(service: string, options?: { firmId?: string; mode?: 'maxed' | 'direct' }): string {
  const params = new URLSearchParams();
  const firmId = options?.firmId || getFirmId();
  if (firmId) params.set('firmId', firmId);
  if (options?.mode) params.set('mode', options.mode);
  const query = params.toString();
  return `${API_URL}/bridge/${service}${query ? `?${query}` : ''}`;
}

export function firmApiUrl(path: string): string {
  return `${API_URL}/api/firms/${getFirmId()}${path}`;
}

// Headers to include on all service proxy calls — tells the API which firm's credentials to use
export function serviceHeaders(): Record<string, string> {
  const firmId = getFirmId();
  return {
    ...(firmId ? { 'X-Firm-Id': firmId } : {}),
  };
}

export function installApiFetchCredentials() {
  if (typeof window === 'undefined') return;
  const marker = '__maxedFetchCredentialsInstalled';
  if ((window as any)[marker]) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const shouldIncludeCredentials =
      typeof requestUrl === 'string' &&
      (requestUrl.startsWith(API_URL) || requestUrl.startsWith('/api/platform/session/'));

    const nextInit = shouldIncludeCredentials && !init?.credentials
      ? { ...init, credentials: 'include' as RequestCredentials }
      : init;

    return originalFetch(input as any, nextInit);
  }) as typeof window.fetch;

  (window as any)[marker] = true;
}

export async function apiFetch<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = path.startsWith('/api/firms')
    ? apiUrl(path)
    : firmApiUrl(path);

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...serviceHeaders(),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export { _firmId as FIRM_ID };
