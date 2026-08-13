import { describe, expect, it } from 'vitest';
import type { QueryTemplate } from './types.js';
import {
  browserSearchUrl,
  buildVisualQuery,
  compileQueries,
  compileQueriesForScopes,
  QueryCompileError,
} from './query.js';
import { parseScope, parseScopeList } from './scope.js';

const base: QueryTemplate = {
  id: 'test',
  packId: 'pack',
  name: 'Test',
  description: 'Test template',
  category: 'documents',
  supportedScopeTypes: ['exact-domain', 'subdomain-tree'],
  providers: ['google-link', 'brave'],
  template: '{{scope}} filetype:pdf',
  variables: ['scope'],
  tags: ['docs'],
  reviewPriority: 'low',
  explanation: 'Find public PDF pages.',
  safetyLevel: 'low',
  requiresExplicitAuthorization: false,
  resultPolicy: 'in-scope',
  resultHostAllowlist: [],
};

describe('query compiler', () => {
  it('compiles provider-specific scope and deduplicates equivalent queries', () => {
    const duplicate = { ...base, id: 'duplicate' };
    const queries = compileQueries(parseScope('*.example.com'), [base, duplicate], {
      provider: 'google-link',
    });
    expect(queries).toHaveLength(1);
    expect(queries[0]?.query).toBe('(site:example.com OR site:*.example.com) filetype:pdf');
  });

  it('filters incompatible scope and provider types', () => {
    expect(compileQueries(parseScope('*.uz'), [base], { provider: 'google-link' })).toHaveLength(0);
    expect(compileQueries(parseScope('example.com'), [base], { provider: 'mock' })).toHaveLength(0);
  });

  it('requires explicit confirmation and redacts sensitive previews', () => {
    const sensitive: QueryTemplate = {
      ...base,
      id: 'sensitive',
      safetyLevel: 'sensitive',
      requiresExplicitAuthorization: true,
      supportedScopeTypes: ['exact-domain'],
      template: '{{scope}} "api key"',
    };
    expect(
      compileQueries(parseScope('example.com'), [sensitive], { provider: 'google-link' }),
    ).toHaveLength(0);
    const [query] = compileQueries(parseScope('example.com'), [sensitive], {
      provider: 'google-link',
      authorizationConfirmed: true,
    });
    expect(query?.query).toContain('example.com');
    expect(query?.displayQuery).not.toContain('example.com');
    expect(query?.displayQuery).toContain('[redacted-indicator]');
  });

  it('caps generated queries at the scope hard limit', () => {
    const templates = Array.from({ length: 20 }, (_, index) => ({
      ...base,
      id: `id-${index}`,
      template: `{{scope}} phrase-${index}`,
    }));
    expect(
      compileQueries(
        parseScope('*.uz'),
        templates.map((item) => ({ ...item, supportedScopeTypes: ['public-suffix'] })),
        { provider: 'google-link' },
      ),
    ).toHaveLength(8);
  });

  it('compiles a manual authorized list with a global cap', () => {
    const queries = compileQueriesForScopes(parseScopeList('example.com\nexample.org'), [base], {
      provider: 'google-link',
      globalMaximum: 2,
    });
    expect(queries.map((query) => query.query)).toEqual([
      'site:example.com filetype:pdf',
      'site:example.org filetype:pdf',
    ]);
  });

  it('rejects custom operator injection and allows safe visual fields', () => {
    const scope = parseScope('example.com');
    expect(
      buildVisualQuery(scope, 'google-link', {
        phrase: 'public roadmap',
        inurl: 'docs',
        fileTypes: ['pdf', 'pdf'],
      }),
    ).toBe('site:example.com "public roadmap" inurl:docs filetype:pdf');
    expect(() => buildVisualQuery(scope, 'google-link', { phrase: 'site:evil.test' })).toThrow(
      QueryCompileError,
    );
    expect(() =>
      buildVisualQuery(scope, 'google-link', { intitle: 'x" OR site:evil.test' }),
    ).toThrow(QueryCompileError);
    expect(() => buildVisualQuery(scope, 'google-link', { inurl: 'docs OR unrelated' })).toThrow(
      QueryCompileError,
    );
    expect(() => buildVisualQuery(scope, 'google-link', { inurl: 'docs other' })).toThrow(
      QueryCompileError,
    );
  });

  it('does not broaden a subdomain scope through the domain variable', () => {
    const domainTemplate = {
      ...base,
      template: '"{{domain}}" site:github.com',
      variables: ['domain'],
    };
    const [compiled] = compileQueries(parseScope('sub.example.com'), [domainTemplate], {
      provider: 'google-link',
    });
    expect(compiled?.query).toBe('"sub.example.com" site:github.com');
  });

  it('encodes browser deep links and rejects mock links', () => {
    expect(browserSearchUrl('bing-link', 'site:example.com test')).toBe(
      'https://www.bing.com/search?q=site%3Aexample.com%20test',
    );
    expect(() => browserSearchUrl('mock', 'test')).toThrow(QueryCompileError);
  });
});
