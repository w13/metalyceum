import { describe, expect, it } from 'vitest';
import { getOrCreateRequestId, withRequestId } from './request_id';

describe('getOrCreateRequestId', () => {
  it('prefers incoming X-Request-Id values', () => {
    const request = new Request('http://example.test/api/v1/admin/health', {
      headers: { 'X-Request-Id': 'client-trace-1' },
    });
    expect(getOrCreateRequestId(request)).toBe('client-trace-1');
  });

  it('generates a request id when none is provided', () => {
    const request = new Request('http://example.test/api/v1/admin/health');
    const requestId = getOrCreateRequestId(request);
    expect(requestId).toHaveLength(36);
  });
});

describe('withRequestId', () => {
  it('clones a request and injects X-Request-Id', () => {
    const original = new Request('http://example.test/api/v1/admin/health', {
      method: 'GET',
      headers: { Authorization: 'Bearer token' },
    });
    const decorated = withRequestId(original, 'req-789');
    expect(decorated.headers.get('X-Request-Id')).toBe('req-789');
    expect(decorated.headers.get('Authorization')).toBe('Bearer token');
  });
});
