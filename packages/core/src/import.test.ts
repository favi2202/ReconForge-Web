import { describe, expect, it } from 'vitest';
import { MAX_IMPORT_BYTES, validateProjectImport } from './import.js';
import { exportProject } from './reports.js';
import type { ReconProject } from './types.js';
import { parseScope } from './scope.js';

const project: ReconProject = {
  schemaVersion: '1.0',
  id: 'fixture',
  name: 'Fixture',
  authorizationStatement: 'Authorized synthetic fixture only.',
  scope: parseScope('example.com'),
  selectedPackIds: [],
  queries: [],
  findings: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('project import validation', () => {
  it('round-trips a valid exported project', () => {
    expect(validateProjectImport(exportProject(project).json)).toEqual(project);
  });

  it('rejects malformed, oversized, extra-key, and excessive-result imports', () => {
    expect(() => validateProjectImport('{bad')).toThrow('not valid JSON');
    expect(() => validateProjectImport('x'.repeat(MAX_IMPORT_BYTES + 1))).toThrow('size limit');
    expect(() => validateProjectImport(JSON.stringify({ ...project, unexpected: true }))).toThrow(
      'schema validation',
    );
    expect(() =>
      validateProjectImport(
        JSON.stringify({ ...project, findings: Array.from({ length: 5001 }, () => ({})) }),
      ),
    ).toThrow('schema validation');
  });

  it('reconstructs derived scope authority and rejects unsafe finding schemes', () => {
    const tampered = {
      ...project,
      scope: {
        ...project.scope,
        original: '*.uz',
        normalized: 'example.com',
        value: 'example.com',
        type: 'exact-domain',
        hardQueryLimit: 100,
        allowsSensitivePack: true,
      },
    };
    const validated = validateProjectImport(JSON.stringify(tampered));
    expect(validated.scope.type).toBe('public-suffix');
    expect(validated.scope.hardQueryLimit).toBe(8);
    expect(validated.scope.allowsSensitivePack).toBe(false);

    const unsafeFinding = {
      id: 'unsafe',
      url: 'javascript:alert(1)',
      canonicalUrl: 'javascript:alert(1)',
      title: 'Unsafe',
      snippet: '',
      hostname: 'example.com',
      rootDomain: 'example.com',
      source: 'import',
      category: 'documents',
      reviewPriority: 'low',
      firstSeenAt: '2026-01-01T00:00:00.000Z',
      lastSeenAt: '2026-01-01T00:00:00.000Z',
      provenance: [
        {
          provider: 'import',
          queryId: 'q',
          query: 'site:example.com',
          collectedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      tags: [],
      notes: '',
      status: 'unreviewed',
    };
    expect(() =>
      validateProjectImport(JSON.stringify({ ...project, findings: [unsafeFinding] })),
    ).toThrow('schema validation');
  });
});
