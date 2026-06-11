// Metalyceum Server Router and Entry Point

import { AdminDO } from './admin/do';
import { CurrencyDO } from './currency/do';
import type { Bindings } from './constants';
import { logEvent, MetalyceumWorld } from './durable_object';
import { errorEnvelope } from './http/errors';
import { getOrCreateRequestId, withRequestId } from './http/request_id';

export { AdminDO, CurrencyDO, MetalyceumWorld };

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
const NO_STORE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

const ALLOWED_ORIGINS = [
  'https://metalyceum.app',
  'https://www.metalyceum.app',
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : 'https://metalyceum.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export async function handleFetch(
  request: Request,
  env: Bindings,
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const origin = request.headers.get('Origin');
  const requestId = getOrCreateRequestId(request);
  try {
    // API v1 routes → AdminDO
    if (pathname.startsWith('/api/v1/')) {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: { ...corsHeaders(origin), 'X-Request-Id': requestId },
        });
      }

      const id = env.ADMIN_DO.idFromName('admin');
      const stub = env.ADMIN_DO.get(id);
      const response = await stub.fetch(withRequestId(request, requestId));

      // Add CORS headers to response
      const headers = new Headers(response.headers);
      headers.set('X-Request-Id', requestId);
      for (const [key, value] of Object.entries(corsHeaders(origin))) {
        headers.set(key, value);
      }
      for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
        headers.set(key, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // API v2 currency routes → CurrencyDO (read-only public surface)
    // Mutations (credit/debit/transfer/trades) require the authenticated WebSocket
    // session through the world DO; exposing them here would let anyone credit
    // themselves without server-side auth. Only balance and history are safe to
    // expose directly. Path is translated: /api/v2/currency/<op> → /internal/currency/<op>
    // because CurrencyDO matches its own /internal/currency/* paths.
    else if (pathname.startsWith('/api/v2/currency/')) {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: { ...corsHeaders(origin), 'X-Request-Id': requestId },
        });
      }

      // Only allow read-only operations via the public route
      const op = pathname.slice('/api/v2/currency/'.length);
      if (op !== 'balance' && op !== 'history') {
        return new Response(
          JSON.stringify(errorEnvelope(
            'This operation is not available via the public API. Use the authenticated WebSocket session.',
            { requestId },
          )),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'X-Request-Id': requestId,
              ...corsHeaders(origin),
              ...NO_STORE_HEADERS,
            },
          },
        );
      }

      // Translate public path to internal DO path
      const internalUrl = new URL(request.url);
      internalUrl.pathname = `/internal/currency/${op}`;
      const internalRequest = new Request(internalUrl.toString(), request);

      const currencyId = env.CURRENCY_DO.idFromName('currency');
      const currencyStub = env.CURRENCY_DO.get(currencyId);
      const response = await currencyStub.fetch(withRequestId(internalRequest, requestId));

      const headers = new Headers(response.headers);
      headers.set('X-Request-Id', requestId);
      for (const [key, value] of Object.entries(corsHeaders(origin))) {
        headers.set(key, value);
      }
      for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
        headers.set(key, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    if (pathname === '/ws' || pathname === '/debug') {
      const id = env.METALYCEUM_WORLD.idFromName('global-world');
      const stub = env.METALYCEUM_WORLD.get(id);
      const response = await stub.fetch(withRequestId(request, requestId));
      if (pathname !== '/debug') {
        return response;
      }

      const headers = new Headers(response.headers);
      headers.set('X-Request-Id', requestId);
      for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
        headers.set(key, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    const res = await env.ASSETS.fetch(request);
    const headers = new Headers(res.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(key, value);
    }
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logEvent('request_error', {
      requestId,
      pathname,
      method: request.method,
      error: errorMessage,
    });

    if (pathname.startsWith('/api/v1/') || pathname.startsWith('/api/v2/currency/') || pathname === '/debug') {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Metalyceum-Error-Id': requestId,
        'X-Request-Id': requestId,
      });
      if (pathname.startsWith('/api/v1/') || pathname.startsWith('/api/v2/currency/')) {
        for (const [key, value] of Object.entries(corsHeaders(origin))) {
          headers.set(key, value);
        }
      }
      for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
        headers.set(key, value);
      }
      return new Response(
        JSON.stringify(errorEnvelope('Internal server error', { requestId })),
        {
          status: 500,
          headers,
        },
      );
    }

    return new Response(`Internal server error (${requestId})`, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'X-Metalyceum-Error-Id': requestId,
        'X-Request-Id': requestId,
        ...NO_STORE_HEADERS,
      },
    });
  }
}

const handler: ExportedHandler<Bindings> = {
  fetch: handleFetch,
};

export default handler;
