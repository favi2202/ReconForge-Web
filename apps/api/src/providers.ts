import type { RawProviderResult } from '@reconforge/core';
import { z } from 'zod';

export interface ProviderContext {
  signal: AbortSignal;
  maximumResults: number;
}

export type PassiveProviderId = 'mock' | 'brave' | 'urlscan' | 'shodan';

export interface PassiveProvider {
  id: PassiveProviderId;
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

const urlscanResponseSchema = z
  .object({
    results: z
      .array(
        z
          .object({
            _id: z.string().min(1).max(120).optional(),
            task: z
              .object({
                uuid: z.string().min(1).max(120).optional(),
                url: z.string().max(4096).optional(),
                domain: z.string().max(253).optional(),
                time: z.string().max(80).optional(),
              })
              .passthrough()
              .optional(),
            page: z
              .object({
                url: z.string().max(4096).optional(),
                domain: z.string().max(253).optional(),
                title: z.string().max(500).optional(),
                ip: z.string().max(64).optional(),
                server: z.string().max(200).optional(),
                status: z.union([z.string().max(20), z.number()]).optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      )
      .max(100)
      .default([]),
  })
  .passthrough();

const shodanResponseSchema = z
  .object({
    matches: z
      .array(
        z
          .object({
            ip_str: z.string().min(1).max(64).optional(),
            port: z.number().int().min(1).max(65535).optional(),
            transport: z.string().max(20).optional(),
            hostnames: z.array(z.string().max(253)).max(50).optional(),
            domains: z.array(z.string().max(253)).max(50).optional(),
            org: z.string().max(300).optional(),
            isp: z.string().max(300).optional(),
            product: z.string().max(200).optional(),
            version: z.string().max(100).optional(),
            timestamp: z.string().max(80).optional(),
            http: z
              .object({
                title: z.string().max(500).optional(),
                host: z.string().max(253).optional(),
                server: z.string().max(300).optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      )
      .max(100)
      .default([]),
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
    const body = await fetchProviderJson(
      'Brave Search',
      url,
      { Accept: 'application/json', 'X-Subscription-Token': this.apiKey },
      braveResponseSchema,
      this.timeoutMs,
      this.fetcher,
      context.signal,
    );
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
}

export class UrlscanSearchProvider implements PassiveProvider {
  readonly id = 'urlscan';
  readonly name = 'URLScan Search API';
  readonly authentication = 'server-api-key';
  readonly provenance = 'URLScan historical Search API; scan submission is not implemented.';
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
    if (!this.apiKey) throw new ProviderError('URLScan is not configured.', 503);
    const count = Math.max(1, Math.min(context.maximumResults, 20));
    const url = new URL('https://urlscan.io/api/v1/search/');
    url.searchParams.set('q', query);
    url.searchParams.set('size', String(count));
    url.searchParams.set('datasource', 'scans');
    const body = await fetchProviderJson(
      'URLScan',
      url,
      { Accept: 'application/json', 'api-key': this.apiKey },
      urlscanResponseSchema,
      this.timeoutMs,
      this.fetcher,
      context.signal,
    );
    return body.results.slice(0, count).flatMap((item) => {
      const id = item._id ?? item.task?.uuid;
      const subjectHostname = normalizeSubjectHostname(item.page?.domain ?? item.task?.domain);
      if (!id || !subjectHostname) return [];
      const detail = [
        `Observed hostname: ${subjectHostname}`,
        item.page?.ip ? `IP: ${item.page.ip}` : '',
        item.page?.status !== undefined ? `HTTP status: ${String(item.page.status)}` : '',
        item.page?.server ? `Server: ${item.page.server}` : '',
        item.page?.url ? `Observed URL: ${item.page.url}` : '',
      ]
        .filter(Boolean)
        .join('. ');
      return [
        {
          url: `https://urlscan.io/result/${encodeURIComponent(id)}/`,
          title: item.page?.title ?? `URLScan observation for ${subjectHostname}`,
          snippet: detail,
          ...(item.task?.time ? { publishedAt: item.task.time } : {}),
          subjectHostname,
        },
      ];
    });
  }
}

export class ShodanSearchProvider implements PassiveProvider {
  readonly id = 'shodan';
  readonly name = 'Shodan Host Search API';
  readonly authentication = 'server-api-key';
  readonly provenance = 'Shodan existing host index; on-demand scanning is not implemented.';
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
    if (!this.apiKey) throw new ProviderError('Shodan is not configured.', 503);
    const count = Math.max(1, Math.min(context.maximumResults, 20));
    const url = new URL('https://api.shodan.io/shodan/host/search');
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('query', query);
    url.searchParams.set('page', '1');
    url.searchParams.set('minify', 'true');
    url.searchParams.set(
      'fields',
      'ip_str,port,transport,hostnames,domains,org,isp,product,version,timestamp,http.title,http.host,http.server',
    );
    const body = await fetchProviderJson(
      'Shodan',
      url,
      { Accept: 'application/json' },
      shodanResponseSchema,
      this.timeoutMs,
      this.fetcher,
      context.signal,
    );
    const results: RawProviderResult[] = [];
    for (const item of body.matches) {
      const ip = item.ip_str;
      if (!ip) continue;
      const hostnames = [
        ...(item.hostnames ?? []),
        ...(item.http?.host ? [item.http.host.split(':')[0] ?? ''] : []),
        ...(item.domains ?? []),
      ];
      for (const subjectHostname of [...new Set(hostnames.map(normalizeSubjectHostname))]) {
        if (!subjectHostname) continue;
        const port = item.port ?? 443;
        const service = [item.product, item.version].filter(Boolean).join(' ');
        const detail = [
          `Observed hostname: ${subjectHostname}`,
          `IP: ${ip}`,
          `Port: ${port}/${item.transport ?? 'tcp'}`,
          service ? `Service: ${service}` : '',
          item.http?.server ? `HTTP server: ${item.http.server}` : '',
          (item.org ?? item.isp) ? `Organization: ${item.org ?? item.isp}` : '',
        ]
          .filter(Boolean)
          .join('. ');
        results.push({
          url: `https://www.shodan.io/host/${encodeURIComponent(ip)}?port=${port}`,
          title: item.http?.title ?? `${subjectHostname} — ${service || `service on port ${port}`}`,
          snippet: detail,
          ...(item.timestamp ? { publishedAt: item.timestamp } : {}),
          subjectHostname,
        });
        if (results.length >= count) return results;
      }
    }
    return results;
  }
}

async function fetchProviderJson<T>(
  label: string,
  url: URL,
  headers: Record<string, string>,
  schema: z.ZodType<T>,
  timeoutMs: number,
  fetcher: typeof fetch,
  contextSignal: AbortSignal,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const timeoutController = new AbortController();
    const timeout = setTimeout(
      () => timeoutController.abort(new Error('Provider timeout')),
      timeoutMs,
    );
    const signal = AbortSignal.any([contextSignal, timeoutController.signal]);
    let retryDelay = 150 * 2 ** attempt;
    try {
      const response = await fetcher(url, {
        method: 'GET',
        headers,
        signal,
        redirect: 'error',
        cache: 'no-store',
      });
      if (response.ok) {
        const maximumBytes = 2 * 1024 * 1024;
        const contentLength = Number(response.headers.get('content-length') ?? '0');
        if (contentLength > maximumBytes)
          throw new ProviderError(`${label} returned an oversized response.`, 502);
        const text = await readBoundedBody(response, maximumBytes, label);
        const parsed = schema.safeParse(JSON.parse(text) as unknown);
        if (!parsed.success) throw new ProviderError(`${label} returned an invalid response.`, 502);
        return parsed.data;
      }
      if (response.status < 500 && response.status !== 429)
        throw new ProviderError(
          `${label} rejected the request (${response.status}).`,
          response.status,
        );
      retryDelay = boundedRetryAfter(response.headers.get('retry-after'), retryDelay);
      lastError = new ProviderError(`${label} temporarily unavailable (${response.status}).`, 502);
    } catch (error) {
      if (contextSignal.aborted) throw error;
      if (error instanceof ProviderError && error.statusCode < 500 && error.statusCode !== 429)
        throw error;
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < 2) await abortableDelay(retryDelay, contextSignal);
  }
  throw new ProviderError(
    lastError instanceof ProviderError ? lastError.message : `${label} request failed.`,
    502,
  );
}

async function readBoundedBody(
  response: Response,
  maximumBytes: number,
  label: string,
): Promise<string> {
  if (!response.body) throw new ProviderError(`${label} returned an empty response.`, 502);
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
        throw new ProviderError(`${label} returned an oversized response.`, 502);
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

function normalizeSubjectHostname(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/\.$/u, '');
  return normalized && normalized.length <= 253 ? normalized : null;
}

function boundedRetryAfter(value: string | null, fallback: number): number {
  if (!value || !/^\d+$/u.test(value)) return fallback;
  return Math.min(2_000, Math.max(fallback, Number(value) * 1000));
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
