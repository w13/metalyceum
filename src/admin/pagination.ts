export function parsePaginationParams(
  request: Request,
  defaultLimit: number,
  maxLimit: number
): { limit: number; cursor?: string } {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), maxLimit)
    : defaultLimit;
  const cursor = url.searchParams.get("cursor") || undefined;
  return { limit, cursor };
}
