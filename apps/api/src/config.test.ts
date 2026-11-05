import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('API configuration', () => {
  it('defaults to disabled connected mode', () => {
    const config = loadConfig({});
    expect(config.connectedMode).toBe(false);
    expect(config.localToolsEnabled).toBe(false);
    expect(config.providerDailyQueryLimits).toEqual({
      mock: 200,
      brave: 200,
      urlscan: 100,
      shodan: 25,
    });
  });

  it('loads provider keys without exposing them to the browser configuration', () => {
    const config = loadConfig({
      URLSCAN_API_KEY: 'urlscan-private-test-key-1234',
      SHODAN_API_KEY: 'shodan-private-test-key-5678',
      URLSCAN_DAILY_QUERY_LIMIT: '12',
      SHODAN_DAILY_QUERY_LIMIT: '7',
    });
    expect(config.urlscanApiKey).toBe('urlscan-private-test-key-1234');
    expect(config.shodanApiKey).toBe('shodan-private-test-key-5678');
    expect(config.providerDailyQueryLimits.urlscan).toBe(12);
    expect(config.providerDailyQueryLimits.shodan).toBe(7);
  });

  it('requires a long token when enabled and rejects wildcard CORS', () => {
    expect(() => loadConfig({ CONNECTED_MODE: 'true' })).toThrow();
    expect(() => loadConfig({ LOCAL_TOOLS_ENABLED: 'true' })).toThrow('connected owner mode');
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
