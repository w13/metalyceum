import { describe, expect, it } from 'vitest';
import {
  classifySessionSource,
  getHeaderHost,
  getSessionSource,
  trimHeaderValue,
} from './session_source';

describe('session source helpers', () => {
  it('trims and normalizes header whitespace', () => {
    expect(trimHeaderValue('  Mozilla/5.0   Chrome  ')).toBe(
      'Mozilla/5.0 Chrome',
    );
  });

  it('extracts host for valid header URLs and rejects invalid URLs', () => {
    expect(getHeaderHost('https://metalyceum.app/path?q=1')).toBe(
      'metalyceum.app',
    );
    expect(getHeaderHost('not-a-url')).toBeNull();
  });

  it('classifies site browser traffic', () => {
    expect(
      classifySessionSource(
        'metalyceum.app',
        null,
        'Mozilla/5.0 AppleWebKit/537.36 Chrome/124.0',
      ),
    ).toBe('site-browser');
  });

  it('classifies external browser traffic', () => {
    expect(
      classifySessionSource('example.com', null, 'Mozilla/5.0 Firefox/125.0'),
    ).toBe('external-browser');
  });

  it('classifies script traffic', () => {
    expect(classifySessionSource(null, null, 'curl/8.7.1')).toBe('script');
  });

  it('classifies unknown traffic when no match exists', () => {
    expect(classifySessionSource(null, null, 'custom-client/1.0')).toBe(
      'unknown',
    );
  });
});

describe('getSessionSource', () => {
  it('builds session source metadata from request headers', () => {
    const request = new Request('https://metalyceum.app/ws', {
      headers: {
        'User-Agent': 'Mozilla/5.0 Safari/605.1.15',
        Origin: 'https://metalyceum.app',
        Referer: 'https://metalyceum.app/rooms',
      },
    });

    expect(getSessionSource(request)).toEqual({
      clientType: 'site-browser',
      originHost: 'metalyceum.app',
      refererHost: 'metalyceum.app',
      userAgent: 'Mozilla/5.0 Safari/605.1.15',
    });
  });
});
