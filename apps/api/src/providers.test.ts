import { describe, expect, it, vi } from 'vitest';
import { BraveSearchProvider, MockProvider } from './providers.js';

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
