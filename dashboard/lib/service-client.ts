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

function formatDetail(detail: unknown) {
  if (detail == null) return '';
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'number' || typeof detail === 'boolean') return String(detail);
  if (typeof detail === 'object') {
    return Object.entries(detail as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ');
  }
  return '';
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
    credentials: 'include',
    headers: buildHeaders(options),
  });

  const payload = await parsePayload(res);
  if (!res.ok) {
    const errorText =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : res.statusText || 'Request failed';
    const detailText =
      payload && typeof payload === 'object' && 'detail' in payload && (payload as { detail?: unknown }).detail
        ? ` (${formatDetail((payload as { detail: unknown }).detail)})`
        : '';
    throw new Error(`HTTP ${res.status}: ${errorText}${detailText}`);
  }

  return payload as T;
}

export async function firmFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(firmApiUrl(path), {
    ...options,
    credentials: 'include',
    headers: buildHeaders(options),
  });

  const payload = await parsePayload(res);
  if (!res.ok) {
    const errorText =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : res.statusText || 'Request failed';
    const detailText =
      payload && typeof payload === 'object' && 'detail' in payload && (payload as { detail?: unknown }).detail
        ? ` (${formatDetail((payload as { detail: unknown }).detail)})`
        : '';
    throw new Error(`HTTP ${res.status}: ${errorText}${detailText}`);
  }

  return payload as T;
}
