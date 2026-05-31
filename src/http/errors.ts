export type ErrorEnvelope = {
  ok: false;
  error: string;
  requestId?: string;
  details?: Record<string, unknown>;
};

export function errorEnvelope(
  error: string,
  options: { requestId?: string; details?: Record<string, unknown> } = {}
): ErrorEnvelope {
  return {
    ok: false,
    error,
    ...(options.requestId ? { requestId: options.requestId } : {}),
    ...(options.details ? { details: options.details } : {}),
  };
}

export function errorJson(
  error: string,
  status = 400,
  options: { requestId?: string; details?: Record<string, unknown> } = {}
): Response {
  return new Response(JSON.stringify(errorEnvelope(error, options)), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
