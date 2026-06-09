const REQUEST_ID_HEADER = 'X-Request-Id';

export function getOrCreateRequestId(request: Request): string {
  const incoming = request.headers.get(REQUEST_ID_HEADER)?.trim();
  if (incoming) return incoming.slice(0, 128);
  return crypto.randomUUID();
}

export function withRequestId(request: Request, requestId: string): Request {
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Request(request, { headers });
}
