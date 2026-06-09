import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Bindings } from './constants';

vi.mock('./durable_object', () => ({
  MetalyceumWorld: class {},
  logEvent: () => {},
}));
vi.mock('./admin/do', () => ({
  AdminDO: class {},
}));

let handleFetch: typeof import('./index').handleFetch;

beforeAll(async () => {
  ({ handleFetch } = await import('./index'));
});

function makeBindings(
  options: {
    adminFetch?: (request: Request) => Promise<Response> | Response;
    worldFetch?: (request: Request) => Promise<Response> | Response;
    assetFetch?: (request: Request) => Promise<Response> | Response;
  } = {},
): Bindings {
  const adminFetch =
    options.adminFetch ??
    (() => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  const worldFetch =
    options.worldFetch ??
    (() => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  const assetFetch =
    options.assetFetch ?? (() => new Response('ok', { status: 200 }));

  return {
    ADMIN_DO: {
      idFromName: () => ({}) as any,
      get: () =>
        ({
          fetch: adminFetch,
        }) as any,
    } as any,
    METALYCEUM_WORLD: {
      idFromName: () => ({}) as any,
      get: () =>
        ({
          fetch: worldFetch,
        }) as any,
    } as any,
    ASSETS: {
      fetch: assetFetch as any,
    },
  };
}

describe('handleFetch request id propagation', () => {
  it('forwards X-Request-Id to AdminDO and includes it in response headers', async () => {
    let receivedRequestId: string | null = null;
    const env = makeBindings({
      adminFetch: (request) => {
        receivedRequestId = request.headers.get('X-Request-Id');
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    const response = await handleFetch(
      new Request('http://example.test/api/v1/admin/health'),
      env,
    );
    expect(receivedRequestId).toBeTruthy();
    expect(response.headers.get('X-Request-Id')).toBe(receivedRequestId);
  });

  it('preserves caller-provided request ids', async () => {
    let receivedRequestId: string | null = null;
    const env = makeBindings({
      adminFetch: (request) => {
        receivedRequestId = request.headers.get('X-Request-Id');
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    const response = await handleFetch(
      new Request('http://example.test/api/v1/admin/health', {
        headers: { 'X-Request-Id': 'caller-123' },
      }),
      env,
    );

    expect(receivedRequestId).toBe('caller-123');
    expect(response.headers.get('X-Request-Id')).toBe('caller-123');
  });
});

describe('handleFetch error envelope', () => {
  it('returns the JSON error envelope with request id metadata for API failures', async () => {
    const env = makeBindings({
      adminFetch: async () => {
        throw new Error('boom');
      },
    });

    const response = await handleFetch(
      new Request('http://example.test/api/v1/admin/health'),
      env,
    );
    expect(response.status).toBe(500);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('X-Metalyceum-Error-Id')).toBeTruthy();
    expect(response.headers.get('X-Request-Id')).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Internal server error',
      requestId: response.headers.get('X-Request-Id'),
    });
  });
});
