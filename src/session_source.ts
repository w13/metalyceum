import type { SessionSource } from './constants';

const SITE_HOSTS = new Set(['metalyceum.app', 'www.metalyceum.app']);

export function trimHeaderValue(value: string | null, maxLength = 160): string {
  const trimmed = (value || '').trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function getHeaderHost(value: string | null): string | null {
  const candidate = trimHeaderValue(value, 240);
  if (!candidate) return null;
  try {
    return new URL(candidate).host || null;
  } catch {
    return null;
  }
}

export function classifySessionSource(
  originHost: string | null,
  refererHost: string | null,
  userAgent: string,
): SessionSource['clientType'] {
  const normalizedUserAgent = userAgent.toLowerCase();
  const hasSiteOrigin = Boolean(
    (originHost && SITE_HOSTS.has(originHost)) ||
      (refererHost && SITE_HOSTS.has(refererHost)),
  );
  const isBrowser = /mozilla|chrome|safari|firefox|edg\//i.test(
    normalizedUserAgent,
  );
  const isScript =
    /curl|wget|python|aiohttp|node|undici|go-http-client|java|okhttp|postman|insomnia/i.test(
      normalizedUserAgent,
    );

  if (hasSiteOrigin && isBrowser) return 'site-browser';
  if (isBrowser) return 'external-browser';
  if (isScript) return 'script';
  return 'unknown';
}

export function getSessionSource(request: Request): SessionSource {
  const userAgent = trimHeaderValue(request.headers.get('User-Agent'));
  const originHost = getHeaderHost(request.headers.get('Origin'));
  const refererHost = getHeaderHost(request.headers.get('Referer'));
  return {
    clientType: classifySessionSource(originHost, refererHost, userAgent),
    originHost,
    refererHost,
    userAgent,
  };
}
