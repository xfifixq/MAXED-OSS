const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const FIRM_ID = '1'; // Hardcoded for now; will come from session

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export function firmApiUrl(path: string): string {
  return `${API_URL}/api/firms/${FIRM_ID}${path}`;
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
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export { FIRM_ID };
