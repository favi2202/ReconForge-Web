import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('API configuration', () => {
  it('defaults to disabled connected mode', () => {
    expect(loadConfig({}).connectedMode).toBe(false);
  });

  it('requires a long token when enabled and rejects wildcard CORS', () => {
    expect(() => loadConfig({ CONNECTED_MODE: 'true' })).toThrow();
    expect(() => loadConfig({ CORS_ALLOWLIST: '*' })).toThrow();
    expect(
      loadConfig({
        CONNECTED_MODE: 'true',
        APP_ACCESS_TOKEN: 'correct-horse-battery-staple-2026-owner',
        CORS_ALLOWLIST: 'https://one.test,https://two.test',
      }).corsAllowlist,
    ).toEqual(['https://one.test', 'https://two.test']);
    expect(() =>
      loadConfig({
        CONNECTED_MODE: 'true',
        APP_ACCESS_TOKEN: 'replace-with-a-long-random-token',
      }),
    ).toThrow('placeholder');
    expect(() => loadConfig({ CORS_ALLOWLIST: 'null' })).toThrow();
    expect(() => loadConfig({ CORS_ALLOWLIST: 'https://one.test/path' })).toThrow();
  });
});
