import {
  compileQueries,
  deduplicateFindings,
  normalizeProviderResult,
  parseScope,
  type ReconProject,
} from '@reconforge/core';
import { templatesForPacks } from '@reconforge/templates';

export function createDemoProject(): ReconProject {
  const scope = parseScope('*.example.com', ['legacy.example.com']);
  const selectedPackIds = [
    'domain-discovery',
    'public-documents',
    'api-docs',
    'historical',
    'social-brand',
  ];
  const queries = compileQueries(scope, templatesForPacks(selectedPackIds), {
    provider: 'google-link',
    authorizationConfirmed: true,
  });
  const time = '2026-01-15T10:30:00.000Z';
  const inputs = [
    [
      'https://www.example.com/resources/annual-report.pdf?utm_source=fixture',
      '2025 public annual report',
      'Synthetic public PDF used to demonstrate indexed document review.',
      2,
    ],
    [
      'https://docs.example.com/api/reference',
      'Example API reference',
      'Synthetic developer documentation; no live host was contacted.',
      3,
    ],
    [
      'https://portal.example.com/sign-in',
      'Customer portal sign in',
      'Synthetic login surface for analyst workflow demonstration.',
      0,
    ],
    [
      'https://blog.example.com/engineering/platform-migration',
      'Platform migration notes',
      'Synthetic public engineering article with historical context.',
      4,
    ],
    [
      'https://www.example.com/about/contact',
      'Contact Example',
      'Synthetic organizational and contact page.',
      1,
    ],
  ] as const;
  const findings = inputs.map(([url, title, snippet, index]) => {
    const query = queries[index] ?? queries[0];
    if (!query) throw new Error('Demo query catalog is empty.');
    return normalizeProviderResult({ url, title, snippet }, query, 'synthetic-demo', time);
  });
  findings[1] = {
    ...findings[1]!,
    reviewPriority: 'medium',
    tags: ['api', 'documentation'],
    notes: 'Confirm the documentation version with the service owner.',
    status: 'reviewing',
  };
  findings[2] = {
    ...findings[2]!,
    reviewPriority: 'high',
    tags: ['login', 'inventory'],
    notes: '',
    status: 'unreviewed',
  };
  findings[4] = {
    ...findings[4]!,
    status: 'validated',
    notes: 'Confirmed as the public contact page.',
    tags: ['contact', 'organization'],
  };
  const duplicateQuery = queries[1] ?? queries[0];
  if (!duplicateQuery) throw new Error('Demo query catalog is empty.');
  const duplicateEvidence = normalizeProviderResult(
    {
      url: 'http://www.example.com/resources/annual-report.pdf?ref=second-source',
      title: 'Annual report mirror reference',
      snippet: 'Second synthetic provenance record for deterministic deduplication.',
    },
    duplicateQuery,
    'synthetic-secondary',
    '2026-01-15T10:31:00.000Z',
  );
  const normalizedFindings = deduplicateFindings([...findings, duplicateEvidence]);
  const likelyFalsePositive = normalizedFindings.find(
    (item) => item.hostname === 'blog.example.com',
  );
  if (likelyFalsePositive) {
    likelyFalsePositive.status = 'false-positive';
    likelyFalsePositive.notes =
      'Synthetic false positive: the migration article is contextual, not an exposed service.';
    likelyFalsePositive.tags = [...new Set([...likelyFalsePositive.tags, 'synthetic-demo'])];
  }
  return {
    schemaVersion: '1.0',
    id: 'synthetic-example-demo',
    name: 'Example Corp — synthetic demonstration',
    authorizationStatement:
      'Synthetic example.com data approved for local product demonstration only.',
    scope,
    selectedPackIds,
    queries,
    findings: normalizedFindings,
    createdAt: time,
    updatedAt: time,
  };
}
