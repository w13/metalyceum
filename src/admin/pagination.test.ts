import { describe, expect, it } from 'vitest';
import { parsePaginationParams } from './pagination';

function requestWithQuery(query: string): Request {
  return new Request(`https://example.test/api/v1/admin/users${query}`);
}

describe('parsePaginationParams', () => {
  it('uses default limit when no limit is provided', () => {
    expect(parsePaginationParams(requestWithQuery(''), 50, 100)).toEqual({
      limit: 50,
    });
  });

  it('accepts positive numeric limits', () => {
    expect(
      parsePaginationParams(requestWithQuery('?limit=25'), 50, 100),
    ).toEqual({ limit: 25 });
  });

  it('floors decimal limits and caps at max', () => {
    expect(
      parsePaginationParams(requestWithQuery('?limit=33.9'), 50, 100),
    ).toEqual({ limit: 33 });
    expect(
      parsePaginationParams(requestWithQuery('?limit=250'), 50, 100),
    ).toEqual({ limit: 100 });
  });

  it('falls back to default for zero, negatives, and non-numbers', () => {
    expect(
      parsePaginationParams(requestWithQuery('?limit=0'), 50, 100),
    ).toEqual({ limit: 50 });
    expect(
      parsePaginationParams(requestWithQuery('?limit=-4'), 50, 100),
    ).toEqual({ limit: 50 });
    expect(
      parsePaginationParams(requestWithQuery('?limit=abc'), 50, 100),
    ).toEqual({ limit: 50 });
  });

  it('returns cursor when present', () => {
    expect(
      parsePaginationParams(requestWithQuery('?cursor=next-123'), 50, 100),
    ).toEqual({
      limit: 50,
      cursor: 'next-123',
    });
  });
});
