'use client';

import { apiUrl, firmApiUrl, serviceHeaders } from './api';

async function parsePayload(res: Response) {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildHeaders(options?: RequestInit) {
  const headers = new Headers(options?.headers || {});
  Object.entries(serviceHeaders()).forEach(([key, value]) => {
    if (!headers.has(key)) headers.set(key, value);
  });

  if (!headers.has('Content-Type') && options?.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

export async function serviceFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: buildHeaders(options),
  });

  const payload = await parsePayload(res);
  if (!res.ok) {
    const detail =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `${res.status} ${res.statusText}`;
    throw new Error(detail);
  }

  return payload as T;
}

export async function firmFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(firmApiUrl(path), {
    ...options,
    headers: buildHeaders(options),
  });

  const payload = await parsePayload(res);
  if (!res.ok) {
    const detail =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `${res.status} ${res.statusText}`;
    throw new Error(detail);
  }

  return payload as T;
}
