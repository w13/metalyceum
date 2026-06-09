export type InternalWorldResponse<T = unknown> = {
  ok: boolean;
  data?: T;
};

export function isInternalWorldResponse(
  value: unknown,
): value is InternalWorldResponse {
  if (typeof value !== 'object' || value === null) return false;
  if (!('ok' in value)) return false;
  return typeof (value as { ok?: unknown }).ok === 'boolean';
}
