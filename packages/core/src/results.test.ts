import { describe, expect, it } from 'vitest';
import type { CompiledQuery } from './types.js';
import { parseScope } from './scope.js';
import {
  canonicalizeUrl,
  deduplicateFindings,
  groupFindingsByHost,
  isProviderResultAllowed,
  normalizeProviderResult,
} from './results.js';

const query: CompiledQuery = {
  id: 'q1',
  templateId: 't1',
  packId: 'p1',
  provider: 'mock',
  query: 'site:example.com',
  displayQuery: 'site:example.com',
  explanation: 'Baseline',
  category: 'documents',
  tags: ['docs'],
  reviewPriority: 'low',
  safetyLevel: 'low',
  resultPolicy: 'in-scope',
  resultHostAllowlist: [],
};

describe('result normalization', () => {
  it('canonicalizes protocols, casing, ports, tracking, fragments, ordering, and slashes', () => {
    expect(canonicalizeUrl('http://EXAMPLE.com:80/docs//item/?utm_source=x&b=2&a=1#top')).toBe(
      'https://example.com/docs/item?a=1&b=2',
    );
  });

  it.each(['ftp://example.com/file', 'javascript:alert(1)', 'data:text/plain,test'])(
    'rejects unsafe URL schemes',
    (url) => {
      expect(() => canonicalizeUrl(url)).toThrow('Only HTTP(S)');
    },
  );

  it('cleans control characters and assigns review priority', () => {
    const finding = normalizeProviderResult(
      {
        url: 'https://portal.example.com/admin',
        title: 'Admin\u0000 portal',
        snippet: 'configuration error',
      },
      query,
      'mock',
      '2026-01-01T00:00:00.000Z',
    );
    expect(finding.title).toBe('Admin portal');
    expect(finding.rootDomain).toBe('example.com');
    expect(finding.reviewPriority).toBe('medium');
  });

  it('deduplicates canonical URLs and merges provenance, tags, and priority', () => {
    const first = normalizeProviderResult(
      { url: 'https://example.com/a?utm_source=x', title: 'A' },
      query,
      'mock',
      '2026-01-01T00:00:00.000Z',
    );
    const second = normalizeProviderResult(
      { url: 'http://EXAMPLE.com/a', title: 'A2', snippet: 'configuration error with more detail' },
      { ...query, id: 'q2', reviewPriority: 'high', tags: ['config'] },
      'brave',
      '2026-01-02T00:00:00.000Z',
    );
    const [merged] = deduplicateFindings([first, second]);
    expect(merged?.provenance).toHaveLength(2);
    expect(merged?.reviewPriority).toBe('high');
    expect(merged?.tags).toEqual(['docs', 'config']);
    expect(merged?.lastSeenAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('groups results deterministically by hostname', () => {
    const a = normalizeProviderResult({ url: 'https://z.example.com/a' }, query, 'mock');
    const b = normalizeProviderResult({ url: 'https://a.example.com/b' }, query, 'mock');
    expect(Object.keys(groupFindingsByHost([a, b]))).toEqual(['a.example.com', 'z.example.com']);
  });

  it('enforces in-scope and fixed-host provider result policies', () => {
    const exact = parseScope('example.com');
    expect(isProviderResultAllowed({ url: 'https://example.com/a' }, query, exact)).toBe(true);
    expect(isProviderResultAllowed({ url: 'https://sub.example.com/a' }, query, exact)).toBe(false);

    const fixed = {
      ...query,
      resultPolicy: 'fixed-hosts' as const,
      resultHostAllowlist: ['github.com'],
    };
    expect(
      isProviderResultAllowed(
        { url: 'https://gist.github.com/a', snippet: 'Reference to example.com' },
        fixed,
        exact,
      ),
    ).toBe(true);
    expect(
      isProviderResultAllowed(
        { url: 'https://github.com.evil.test/a', snippet: 'example.com' },
        fixed,
        exact,
      ),
    ).toBe(false);
    expect(isProviderResultAllowed({ url: 'https://github.com/a' }, fixed, exact)).toBe(false);
  });

  it('requires external-reference evidence and never reclassifies excluded in-boundary hosts', () => {
    const scope = parseScope('*.example.com', ['legacy.example.com']);
    const external = { ...query, resultPolicy: 'external-reference' as const };
    expect(
      isProviderResultAllowed(
        { url: 'https://news.example.test/post', title: 'example.com announcement' },
        external,
        scope,
      ),
    ).toBe(true);
    expect(
      isProviderResultAllowed(
        { url: 'https://news.example.test/post', title: 'unrelated announcement' },
        external,
        scope,
      ),
    ).toBe(false);
    expect(
      isProviderResultAllowed(
        { url: 'https://legacy.example.com/post', title: 'example.com announcement' },
        external,
        scope,
      ),
    ).toBe(false);
  });
});
