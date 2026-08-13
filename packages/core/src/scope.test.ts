import { describe, expect, it } from 'vitest';
import {
  compileScopeSyntax,
  describeScopeBreadth,
  parseScope,
  parseScopeList,
  isHostnameInScope,
  isHostnameWithinBoundary,
  isUrlInScope,
  ScopeError,
} from './scope.js';

describe('parseScope', () => {
  it.each([
    ['example.com', 'exact-domain', 'example.com'],
    ['sub.example.com', 'exact-domain', 'sub.example.com'],
    ['*.example.com', 'subdomain-tree', '*.example.com'],
    ['*.uz', 'public-suffix', '*.uz'],
    ['*.co.uk', 'public-suffix', '*.co.uk'],
  ] as const)('classifies %s as %s', (input, type, normalized) => {
    const scope = parseScope(input);
    expect(scope.type).toBe(type);
    expect(scope.normalized).toBe(normalized);
  });

  it('uses the maintained PSL for multi-label suffixes', () => {
    const scope = parseScope('*.service.example.co.uk');
    expect(scope.publicSuffix).toBe('co.uk');
    expect(scope.registrableDomain).toBe('example.co.uk');
    expect(scope.type).toBe('subdomain-tree');
  });

  it('caps broad suffix scopes and disables sensitive packs', () => {
    const scope = parseScope('*.uz');
    expect(scope.warning).toContain('extremely broad');
    expect(scope.hardQueryLimit).toBe(8);
    expect(scope.allowsSensitivePack).toBe(false);
    expect(describeScopeBreadth(scope)).toBe('broad');
  });

  it('normalizes and bounds exclusions', () => {
    const scope = parseScope('*.example.com', [
      'APP.EXAMPLE.COM.',
      'outside.test',
      '*.app.example.com',
    ]);
    expect(scope.exclusions).toEqual(['app.example.com']);
    expect(compileScopeSyntax(scope, 'google-link')).toContain('-site:app.example.com');
  });

  it('accepts a deduplicated manual list of exact authorized domains', () => {
    const scopes = parseScopeList('example.com\nsub.example.com,example.com', ['sub.example.com']);
    expect(scopes.map((scope) => scope.normalized)).toEqual(['example.com', 'sub.example.com']);
    expect(scopes[1]?.exclusions).toEqual(['sub.example.com']);
    expect(() => parseScopeList('example.com\n*.example.org')).toThrow('exact authorized domains');
    expect(() =>
      parseScopeList(
        Array.from({ length: 26 }, (_, index) => `scope${index}.example.com`).join('\n'),
      ),
    ).toThrow('limited to 25');
  });

  it('enforces exact, tree, suffix, and exclusion containment', () => {
    const exact = parseScope('example.com');
    expect(isUrlInScope('https://example.com/a', exact)).toBe(true);
    expect(isUrlInScope('https://www.example.com/a', exact)).toBe(false);
    expect(isUrlInScope('javascript:alert(1)', exact)).toBe(false);

    const tree = parseScope('*.example.com', ['legacy.example.com']);
    expect(isHostnameInScope('example.com', tree)).toBe(true);
    expect(isHostnameInScope('docs.example.com', tree)).toBe(true);
    expect(isHostnameInScope('legacy.example.com', tree)).toBe(false);
    expect(isHostnameWithinBoundary('legacy.example.com', tree)).toBe(true);
    expect(isHostnameInScope('example.com.evil.test', tree)).toBe(false);

    const suffix = parseScope('*.uz');
    expect(isHostnameInScope('service.example.uz', suffix)).toBe(true);
    expect(isHostnameInScope('uz', suffix)).toBe(false);
  });

  it.each([
    'https://example.com',
    'example.com/path',
    'example.com?q=1',
    'user@example.com',
    '127.0.0.1',
    '2001:db8::1',
    '*example.com',
    'foo.*.example.com',
    '**.example.com',
    'localhost',
    '-bad.example.com',
    '',
  ])('rejects invalid scope %j', (input) => {
    expect(() => parseScope(input)).toThrow(ScopeError);
  });
});
