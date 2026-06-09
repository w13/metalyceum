import { describe, expect, it } from 'vitest';
import { parseJsonObjectBody, parseJsonObjectText } from './json';

describe('parseJsonObjectBody', () => {
  it('parses object payloads', async () => {
    const req = new Request('http://example.test', {
      method: 'POST',
      body: JSON.stringify({ message: 'hello' }),
    });

    await expect(parseJsonObjectBody(req)).resolves.toEqual({
      ok: true,
      value: { message: 'hello' },
    });
  });

  it('accepts empty bodies as empty objects', async () => {
    const req = new Request('http://example.test', {
      method: 'POST',
      body: '',
    });
    await expect(parseJsonObjectBody(req)).resolves.toEqual({
      ok: true,
      value: {},
    });
  });

  it('rejects malformed JSON', async () => {
    const req = new Request('http://example.test', {
      method: 'POST',
      body: '{oops',
    });
    await expect(parseJsonObjectBody(req)).resolves.toEqual({
      ok: false,
      error: 'Invalid JSON body',
    });
  });

  it('rejects non-object JSON', async () => {
    const req = new Request('http://example.test', {
      method: 'POST',
      body: JSON.stringify([1, 2, 3]),
    });
    await expect(parseJsonObjectBody(req)).resolves.toEqual({
      ok: false,
      error: 'JSON body must be an object',
    });
  });
});

describe('parseJsonObjectText', () => {
  it('parses object payloads', () => {
    expect(parseJsonObjectText('{"kind":"chat","value":"hi"}')).toEqual({
      ok: true,
      value: { kind: 'chat', value: 'hi' },
    });
  });

  it('rejects malformed JSON text', () => {
    expect(parseJsonObjectText('{invalid')).toEqual({
      ok: false,
      error: 'Invalid JSON body',
    });
  });

  it('rejects non-object JSON text', () => {
    expect(parseJsonObjectText('[1,2,3]')).toEqual({
      ok: false,
      error: 'JSON body must be an object',
    });
  });
});
