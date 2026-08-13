import { describe, expect, it } from 'vitest';
import { compileQueries, parseScope } from '@reconforge/core';
import { packs, publicSuffixPackIds, templates, templatesForPacks } from './catalog.js';

describe('template catalog', () => {
  it('uses stable unique IDs and complete pack references', () => {
    expect(new Set(templates.map((item) => item.id)).size).toBe(templates.length);
    expect(new Set(packs.map((item) => item.id)).size).toBe(packs.length);
    for (const pack of packs)
      for (const id of pack.templateIds)
        expect(templates.some((item) => item.id === id)).toBe(true);
  });

  it('implements every required product pack plus sensitive review', () => {
    expect(packs.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'domain-discovery',
        'public-documents',
        'api-docs',
        'admin-surface',
        'error-disclosure',
        'directory-indicators',
        'backup-config',
        'cloud-references',
        'source-references',
        'historical',
        'social-brand',
        'organization',
        'visual-builder',
        'sensitive-review',
      ]),
    );
  });

  it('keeps restricted categories on exact authorized scopes', () => {
    const restricted = new Set([
      'administrative-surface',
      'backup-indicator',
      'configuration-indicator',
      'source-reference',
      'sensitive-exposure-lead',
    ]);
    for (const template of templates.filter((item) => restricted.has(item.category))) {
      expect(template.supportedScopeTypes).toEqual(['exact-domain']);
      expect(template.requiresExplicitAuthorization).toBe(true);
    }
  });

  it('limits public-suffix planning to low-risk compatible templates and eight queries', () => {
    const queries = compileQueries(parseScope('*.uz'), templatesForPacks(publicSuffixPackIds()), {
      provider: 'google-link',
      authorizationConfirmed: true,
    });
    expect(queries.length).toBeLessThanOrEqual(8);
    expect(queries.every((item) => item.safetyLevel === 'low')).toBe(true);
  });
});
