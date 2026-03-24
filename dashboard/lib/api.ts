const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const FIRM_STORAGE_KEY = 'maxed:firmId';
const PLATFORM_SESSION_STORAGE_KEY = 'maxed:platformSessionToken';

function readStoredFirmId(): string {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(FIRM_STORAGE_KEY) || '';
}

let _firmId = readStoredFirmId();
let _platformSessionToken =
  typeof window === 'undefined'
    ? ''
    : window.sessionStorage.getItem(PLATFORM_SESSION_STORAGE_KEY) || '';

export function setFirmId(id: string) {
  _firmId = id;
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(FIRM_STORAGE_KEY, id);
  }
}

export function clearFirmId() {
  _firmId = '';
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(FIRM_STORAGE_KEY);
  }
}

export function setPlatformSessionToken(token: string) {
  _platformSessionToken = token;
  if (typeof window !== 'undefined') {
    if (token) window.sessionStorage.setItem(PLATFORM_SESSION_STORAGE_KEY, token);
    else window.sessionStorage.removeItem(PLATFORM_SESSION_STORAGE_KEY);
  }
}

export function clearPlatformSessionToken() {
  _platformSessionToken = '';
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(PLATFORM_SESSION_STORAGE_KEY);
  }
}

export function getPlatformSessionToken(): string {
  if (!_platformSessionToken && typeof window !== 'undefined') {
    _platformSessionToken = window.sessionStorage.getItem(PLATFORM_SESSION_STORAGE_KEY) || '';
  }
  return _platformSessionToken;
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

export function firmApiUrl(path: string): string {
  return `${API_URL}/api/firms/${getFirmId()}${path}`;
}

// Headers to include on all service proxy calls — tells the API which firm's credentials to use
export function serviceHeaders(): Record<string, string> {
  const firmId = getFirmId();
  const platformSessionToken = getPlatformSessionToken();
  return {
    ...(firmId ? { 'X-Firm-Id': firmId } : {}),
    ...(platformSessionToken ? { 'X-Maxed-Session': platformSessionToken } : {}),
  };
}

export function installApiFetchCredentials() {
  if (typeof window === 'undefined') return;

  const marker = '__maxedFetchCredentialsInstalled';
  const windowWithMarker = window as Window & {
    __maxedFetchCredentialsInstalled?: boolean;
  };

  if (windowWithMarker[marker]) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const shouldAugment =
      typeof requestUrl === 'string' &&
      requestUrl.startsWith(API_URL);

    if (!shouldAugment) {
      return originalFetch(input as RequestInfo, init);
    }

    const headers = new Headers(
      init?.headers || (input instanceof Request ? input.headers : undefined),
    );
    const platformSessionToken = getPlatformSessionToken();
    if (platformSessionToken && !headers.has('X-Maxed-Session')) {
      headers.set('X-Maxed-Session', platformSessionToken);
    }

    if (!headers.has('Content-Type') && init?.body && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    return originalFetch(input as RequestInfo, {
      ...init,
      credentials: init?.credentials || 'include',
      headers,
    });
  }) as typeof window.fetch;

  windowWithMarker[marker] = true;
}

export async function apiFetch<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = path.startsWith('/api/firms')
    ? apiUrl(path)
    : firmApiUrl(path);

  const res = await fetch(url, {
    credentials: 'include',
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
