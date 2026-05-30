// Metalyceum Server Router and Entry Point
import { MetalyceumWorld } from "./durable_object";
import { type Bindings } from "./constants";

export { MetalyceumWorld };

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin"
};

async function handleFetch(request: Request, env: Bindings): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/ws" || pathname === "/debug") {
    const id = env.METALYCEUM_WORLD.idFromName("global-world");
    const stub = env.METALYCEUM_WORLD.get(id);
    return stub.fetch(request);
  }

  const res = await env.ASSETS.fetch(request);
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers
  });
}

const handler: ExportedHandler<Bindings> = {
  fetch: handleFetch
};

export default handler;
