import type { RawProviderResult } from '@reconforge/core';
import { z } from 'zod';

export interface ProviderContext {
  signal: AbortSignal;
  maximumResults: number;
}

export interface PassiveProvider {
  id: 'mock' | 'brave';
  name: string;
  available: boolean;
  authentication: 'none' | 'server-api-key';
  provenance: string;
  supportedScopeTypes: readonly ['exact-domain', 'subdomain-tree'];
  search(query: string, context: ProviderContext): Promise<RawProviderResult[]>;
}

export class MockProvider implements PassiveProvider {
  readonly id = 'mock';
  readonly name = 'Synthetic mock provider';
  readonly available = true;
  readonly authentication = 'none';
  readonly provenance = 'Deterministic synthetic data generated locally; no network contact.';
  readonly supportedScopeTypes = ['exact-domain', 'subdomain-tree'] as const;

  async search(query: string, context: ProviderContext): Promise<RawProviderResult[]> {
    await abortableDelay(35, context.signal);
    const index = stableNumber(query) % 4;
    const host = query.match(/site:(?:\*\.)?([a-z0-9.-]+)/iu)?.[1] ?? 'example.com';
    const fixtures: RawProviderResult[] = [
      {
        url: `https://${host}/resources/report-${index}.pdf?utm_source=mock`,
        title: `Synthetic public report ${index}`,
        snippet: 'Synthetic fixture for document review. No real target was contacted.',
      },
      {
        url: `https://docs.${host}/api/reference/${index}`,
        title: 'Example API reference',
        snippet: 'Synthetic developer documentation result for offline testing.',
      },
      {
        url: `https://portal.${host}/sign-in?ref=demo`,
        title: 'Example account sign in',
        snippet: 'Synthetic login surface. Review priority does not indicate a vulnerability.',
      },
    ];
    return fixtures.slice(0, Math.max(0, Math.min(context.maximumResults, fixtures.length)));
  }
}

const braveResponseSchema = z
  .object({
    web: z
      .object({
        results: z
          .array(
            z.object({
              url: z.string().max(4096).optional(),
              title: z.string().max(500).optional(),
              description: z.string().max(4000).optional(),
            }),
          )
          .max(50)
          .optional(),
      })
      .optional(),
  })
  .passthrough();

export class BraveSearchProvider implements PassiveProvider {
  readonly id = 'brave';
  readonly name = 'Brave Search API';
  readonly authentication = 'server-api-key';
  readonly provenance = 'Brave Search API web results endpoint.';
  readonly supportedScopeTypes = ['exact-domain', 'subdomain-tree'] as const;
  readonly available: boolean;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly timeoutMs: number,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.available = Boolean(apiKey);
  }

  async search(query: string, context: ProviderContext): Promise<RawProviderResult[]> {
    if (!this.apiKey) throw new ProviderError('Brave Search is not configured.', 503);
    const count = Math.max(1, Math.min(context.maximumResults, 20));
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(count));
    url.searchParams.set('safesearch', 'moderate');
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const timeoutController = new AbortController();
      const timeout = setTimeout(
        () => timeoutController.abort(new Error('Provider timeout')),
        this.timeoutMs,
      );
      const signal = AbortSignal.any([context.signal, timeoutController.signal]);
      try {
        const response = await this.fetcher(url, {
          method: 'GET',
          headers: { Accept: 'application/json', 'X-Subscription-Token': this.apiKey },
          signal,
          redirect: 'error',
          cache: 'no-store',
        });
        if (response.ok) {
          const contentLength = Number(response.headers.get('content-length') ?? '0');
          if (contentLength > 2 * 1024 * 1024)
            throw new ProviderError('Brave Search returned an oversized response.', 502);
          const text = await readBoundedBody(response, 2 * 1024 * 1024);
          const parsed = braveResponseSchema.safeParse(JSON.parse(text) as unknown);
          if (!parsed.success)
            throw new ProviderError('Brave Search returned an invalid response.', 502);
          const body = parsed.data;
          return (body.web?.results ?? []).slice(0, count).flatMap((item) =>
            item.url
              ? [
                  {
                    url: item.url,
                    title: item.title ?? '(untitled result)',
                    snippet: item.description ?? '',
                  },
                ]
              : [],
          );
        }
        if (response.status < 500 && response.status !== 429)
          throw new ProviderError(
            `Brave Search rejected the request (${response.status}).`,
            response.status,
          );
        lastError = new ProviderError(
          `Brave Search temporarily unavailable (${response.status}).`,
          502,
        );
      } catch (error) {
        if (context.signal.aborted) throw error;
        if (error instanceof ProviderError && error.statusCode < 500 && error.statusCode !== 429)
          throw error;
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
      if (attempt < 2) await abortableDelay(150 * 2 ** attempt, context.signal);
    }
    throw new ProviderError(
      lastError instanceof Error ? lastError.message : 'Brave Search request failed.',
      502,
    );
  }
}

async function readBoundedBody(response: Response, maximumBytes: number): Promise<string> {
  if (!response.body) throw new ProviderError('Brave Search returned an empty response.', 502);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new ProviderError('Brave Search returned an oversized response.', 502);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

function stableNumber(value: string): number {
  let hash = 0;
  for (const character of value) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error('Operation cancelled.'));
      return;
    }
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason instanceof Error ? signal.reason : new Error('Operation cancelled.'));
      },
      { once: true },
    );
  });
}
