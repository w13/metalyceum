import { describe, expect, it } from 'vitest';
import { parseJsonObjectBody } from './json';

describe('admin/json re-export', () => {
  it('exposes parseJsonObjectBody from shared HTTP helpers', async () => {
    const req = new Request('http://example.test', {
      method: 'POST',
      body: JSON.stringify({ token: 'abc123' }),
    });

    await expect(parseJsonObjectBody(req)).resolves.toEqual({
      ok: true,
      value: { token: 'abc123' },
    });
  });
});
