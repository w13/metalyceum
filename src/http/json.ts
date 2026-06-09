export type JsonObject = Record<string, unknown>;

export type ParsedJsonObject =
  | { ok: true; value: JsonObject }
  | { ok: false; error: string };

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseJsonObjectText(raw: string): ParsedJsonObject {
  if (!raw.trim()) {
    return { ok: true, value: {} };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Invalid JSON body' };
  }

  if (!isJsonObject(parsed)) {
    return { ok: false, error: 'JSON body must be an object' };
  }

  return { ok: true, value: parsed };
}

export async function parseJsonObjectBody(
  request: Request,
): Promise<ParsedJsonObject> {
  const raw = await request.text();
  return parseJsonObjectText(raw);
}
