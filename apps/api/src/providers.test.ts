import { describe, expect, it, vi } from 'vitest';
import {
  BraveSearchProvider,
  MockProvider,
  ShodanSearchProvider,
  UrlscanSearchProvider,
} from './providers.js';

describe('provider adapters', () => {
  it('returns deterministic mock data without network access', async () => {
    const provider = new MockProvider();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const results = await provider.search('site:example.com filetype:pdf', {
      signal: new AbortController().signal,
      maximumResults: 2,
    });
    expect(results).toHaveLength(2);
    expect(results.every((item) => item.url.includes('example.com'))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('uses only the fixed Brave endpoint and maps official response fields', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          web: {
            results: [{ url: 'https://example.com/a', title: 'A', description: 'Public page' }],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const provider = new BraveSearchProvider('server-side-key-value', 1000, fetcher);
    const results = await provider.search('site:example.com', {
      signal: new AbortController().signal,
      maximumResults: 5,
    });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toMatch(/^https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search\?/u);
    expect(String(url)).toContain('q=site%3Aexample.com');
    expect((init?.headers as Record<string, string>)['X-Subscription-Token']).toBe(
      'server-side-key-value',
    );
    expect(init?.redirect).toBe('error');
    expect(init?.cache).toBe('no-store');
    expect(results).toEqual([{ url: 'https://example.com/a', title: 'A', snippet: 'Public page' }]);
  });

  it('searches only the fixed URLScan endpoint and returns historical evidence links', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              _id: '00000000-0000-4000-8000-000000000001',
              task: { time: '2026-08-01T12:00:00.000Z', domain: 'portal.example.com' },
              page: {
                domain: 'portal.example.com',
                title: 'Example portal',
                url: 'https://portal.example.com/login',
                ip: '192.0.2.10',
                status: 200,
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const provider = new UrlscanSearchProvider('urlscan-server-key', 1000, fetcher);
    const results = await provider.search('page.domain:example.com', {
      signal: new AbortController().signal,
      maximumResults: 5,
    });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toMatch(/^https:\/\/urlscan\.io\/api\/v1\/search\/\?/u);
    expect(String(url)).toContain('q=page.domain%3Aexample.com');
    expect((init?.headers as Record<string, string>)['api-key']).toBe('urlscan-server-key');
    expect(results).toEqual([
      expect.objectContaining({
        url: 'https://urlscan.io/result/00000000-0000-4000-8000-000000000001/',
        title: 'Example portal',
        subjectHostname: 'portal.example.com',
      }),
    ]);
    expect(results[0]?.snippet).toContain('Observed hostname: portal.example.com');
  });

  it('searches only Shodan existing observations and never invokes scan endpoints', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          matches: [
            {
              ip_str: '192.0.2.20',
              port: 443,
              transport: 'tcp',
              hostnames: ['api.example.com'],
              org: 'Example Network',
              product: 'nginx',
              version: '1.26',
              timestamp: '2026-08-01T12:00:00.000Z',
              http: { title: 'Example API', server: 'nginx' },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const provider = new ShodanSearchProvider('shodan-server-key', 1000, fetcher);
    const results = await provider.search('hostname:example.com', {
      signal: new AbortController().signal,
      maximumResults: 5,
    });
    const [url] = fetcher.mock.calls[0] ?? [];
    const requestUrl = new URL(String(url));
    expect(requestUrl.origin).toBe('https://api.shodan.io');
    expect(requestUrl.pathname).toBe('/shodan/host/search');
    expect(requestUrl.searchParams.get('query')).toBe('hostname:example.com');
    expect(requestUrl.searchParams.get('key')).toBe('shodan-server-key');
    expect(results).toEqual([
      expect.objectContaining({
        url: 'https://www.shodan.io/host/192.0.2.20?port=443',
        title: 'Example API',
        subjectHostname: 'api.example.com',
      }),
    ]);
    expect(String(url)).not.toContain('/shodan/scan');
    expect(results[0]?.snippet).not.toContain('HTTP/1.1');
  });

  it('does not expose a Shodan query-string key through transport errors', async () => {
    const secret = 'shodan-sensitive-query-key';
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError(`request to https://api.shodan.io/?key=${secret} failed`));
    const provider = new ShodanSearchProvider(secret, 1000, fetcher);
    await expect(
      provider.search('hostname:example.com', {
        signal: new AbortController().signal,
        maximumResults: 1,
      }),
    ).rejects.not.toThrow(secret);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-transient provider rejections', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 401 }));
    const provider = new BraveSearchProvider('server-side-key-value', 1000, fetcher);
    await expect(
      provider.search('site:example.com', {
        signal: new AbortController().signal,
        maximumResults: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized provider bodies before JSON parsing', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('x', {
        status: 200,
        headers: { 'Content-Length': String(2 * 1024 * 1024 + 1) },
      }),
    );
    const provider = new BraveSearchProvider('server-side-key-value', 1000, fetcher);
    await expect(
      provider.search('site:example.com', {
        signal: new AbortController().signal,
        maximumResults: 1,
      }),
    ).rejects.toThrow('oversized');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('retries bounded transient failures then succeeds', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ web: { results: [] } }), { status: 200 }),
      );
    const provider = new BraveSearchProvider('server-side-key-value', 1000, fetcher);
    await expect(
      provider.search('site:example.com', {
        signal: new AbortController().signal,
        maximumResults: 1,
      }),
    ).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('times out bounded requests without leaking the key', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    const provider = new BraveSearchProvider('highly-sensitive-test-key', 10, fetcher);
    await expect(
      provider.search('site:example.com', {
        signal: new AbortController().signal,
        maximumResults: 1,
      }),
    ).rejects.not.toThrow('highly-sensitive-test-key');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('honors cancellation', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    await expect(
      new MockProvider().search('query', { signal: controller.signal, maximumResults: 1 }),
    ).rejects.toThrow('cancelled');
  });
});
