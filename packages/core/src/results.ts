import { getDomain } from 'tldts';
import { isHostnameInScope, isHostnameWithinBoundary, isUrlInScope } from './scope.js';
import type { CompiledQuery, Finding, ParsedScope, Provenance, ReviewPriority } from './types.js';

const TRACKING_PARAMETERS = new Set([
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'source',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
]);

export interface RawProviderResult {
  url: string;
  title?: string;
  snippet?: string;
  publishedAt?: string;
  /** Provider-asserted subject for evidence links hosted outside the target scope. */
  subjectHostname?: string;
}

export function isProviderResultAllowed(
  result: RawProviderResult,
  query: CompiledQuery,
  scope: ParsedScope,
): boolean {
  let parsedUrl: URL;
  let hostname: string;
  try {
    parsedUrl = new URL(result.url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return false;
    hostname = parsedUrl.hostname.toLowerCase().replace(/\.$/u, '');
  } catch {
    return false;
  }
  if (query.resultPolicy === 'in-scope') return isUrlInScope(result.url, scope);
  const subjectHostname = result.subjectHostname?.toLowerCase().replace(/\.$/u, '');
  if (subjectHostname && !isHostnameInScope(subjectHostname, scope)) return false;
  if ((query.provider === 'urlscan' || query.provider === 'shodan') && !subjectHostname)
    return false;
  const evidence =
    `${parsedUrl.pathname} ${parsedUrl.search} ${result.title ?? ''} ${result.snippet ?? ''}`.toLowerCase();
  const escapedScope = scope.value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  if (!new RegExp(`(^|[^a-z0-9-])${escapedScope}([^a-z0-9-]|$)`, 'iu').test(evidence)) return false;
  if (query.resultPolicy === 'fixed-hosts') {
    return query.resultHostAllowlist.some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
    );
  }
  return !isHostnameWithinBoundary(hostname, scope);
}

export function canonicalizeUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('Only HTTP(S) result URLs are accepted.');
  if (
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80')
  )
    url.port = '';
  url.protocol = 'https:';
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';
  for (const name of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMETERS.has(name.toLowerCase()) || name.toLowerCase().startsWith('utm_'))
      url.searchParams.delete(name);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/{2,}/gu, '/');
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/u, '');
  return url.toString();
}

export function normalizeProviderResult(
  raw: RawProviderResult,
  query: CompiledQuery,
  provider: string,
  collectedAt = new Date().toISOString(),
): Finding {
  const canonicalUrl = canonicalizeUrl(raw.url);
  const url = new URL(canonicalUrl);
  const hostname = raw.subjectHostname?.toLowerCase().replace(/\.$/u, '') ?? url.hostname;
  const provenance: Provenance = {
    provider,
    queryId: query.id,
    query: query.displayQuery,
    collectedAt,
  };
  return {
    id: stableId(canonicalUrl),
    url: raw.url,
    canonicalUrl,
    title: cleanText(raw.title ?? '(untitled result)', 500),
    snippet: cleanText(raw.snippet ?? '', 4000),
    hostname,
    rootDomain: getDomain(hostname, { allowPrivateDomains: true }),
    source: provider,
    category: query.category,
    reviewPriority: calculateReviewPriority(query, raw),
    firstSeenAt: collectedAt,
    lastSeenAt: collectedAt,
    provenance: [provenance],
    tags: [...new Set(query.tags)].slice(0, 30),
    notes: '',
    status: 'unreviewed',
  };
}

function cleanText(value: string, maximum: number): string {
  return [...value]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return (
        character === '\n' ||
        character === '\r' ||
        character === '\t' ||
        (code >= 32 && code !== 127)
      );
    })
    .join('')
    .slice(0, maximum);
}

function calculateReviewPriority(query: CompiledQuery, raw: RawProviderResult): ReviewPriority {
  if (query.reviewPriority === 'high') return 'high';
  const text = `${raw.title ?? ''} ${raw.snippet ?? ''}`.toLowerCase();
  if (query.reviewPriority === 'medium' || /\b(?:admin|backup|configuration|error)\b/u.test(text))
    return 'medium';
  return query.reviewPriority;
}

export function deduplicateFindings(findings: Finding[]): Finding[] {
  const byUrl = new Map<string, Finding>();
  for (const finding of findings) {
    const existing = byUrl.get(finding.canonicalUrl);
    if (!existing) {
      byUrl.set(finding.canonicalUrl, structuredClone(finding));
      continue;
    }
    existing.provenance = uniqueProvenance([...existing.provenance, ...finding.provenance]);
    existing.tags = [...new Set([...existing.tags, ...finding.tags])].slice(0, 30);
    existing.lastSeenAt =
      [existing.lastSeenAt, finding.lastSeenAt].sort().at(-1) ?? existing.lastSeenAt;
    existing.reviewPriority = higherPriority(existing.reviewPriority, finding.reviewPriority);
    if (finding.snippet.length > existing.snippet.length) existing.snippet = finding.snippet;
  }
  return [...byUrl.values()];
}

function uniqueProvenance(items: Provenance[]): Provenance[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.provider}:${item.queryId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function higherPriority(a: ReviewPriority, b: ReviewPriority): ReviewPriority {
  const order: ReviewPriority[] = ['informational', 'low', 'medium', 'high'];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

export function groupFindingsByHost(findings: Finding[]): Record<string, Finding[]> {
  const grouped = new Map<string, Finding[]>();
  for (const finding of findings)
    grouped.set(finding.hostname, [...(grouped.get(finding.hostname) ?? []), finding]);
  return Object.fromEntries([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function stableId(value: string): string {
  let hash = 2166136261;
  let extra = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    extra = Math.imul(extra ^ value.charCodeAt(index), 3266489917);
  }
  return `${(hash >>> 0).toString(16).padStart(8, '0')}${(extra >>> 0).toString(16).padStart(8, '0')}`;
}
