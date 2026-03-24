'use client';

function resolveCookieDomain(hostname: string): string | null {
  const normalized = String(hostname || '').toLowerCase();
  if (!normalized || normalized === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) {
    return null;
  }
  if (normalized === 'maxed.life' || normalized.endsWith('.maxed.life')) {
    return '.maxed.life';
  }
  return null;
}

export function setBrowserPlatformSessionCookie(token: string) {
  if (typeof document === 'undefined' || !token) return;

  const secure = window.location.protocol === 'https:';
  const domain = resolveCookieDomain(window.location.hostname);
  const parts = [
    `maxed_session=${encodeURIComponent(token)}`,
    'Path=/',
    'Max-Age=2592000',
    secure ? 'SameSite=None' : 'SameSite=Lax',
    secure ? 'Secure' : '',
    domain ? `Domain=${domain}` : '',
  ].filter(Boolean);

  document.cookie = parts.join('; ');
}

export function clearBrowserPlatformSessionCookie() {
  if (typeof document === 'undefined') return;

  const secure = window.location.protocol === 'https:';
  const domain = resolveCookieDomain(window.location.hostname);
  const parts = [
    'maxed_session=',
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    secure ? 'SameSite=None' : 'SameSite=Lax',
    secure ? 'Secure' : '',
    domain ? `Domain=${domain}` : '',
  ].filter(Boolean);

  document.cookie = parts.join('; ');
}
