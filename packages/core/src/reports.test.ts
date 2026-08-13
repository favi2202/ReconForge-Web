import { describe, expect, it } from 'vitest';
import type { ReconProject } from './types.js';
import { escapeHtml, exportProject, neutralizeCsvFormula } from './reports.js';
import { normalizeProviderResult } from './results.js';
import { parseScope } from './scope.js';

function fixture(): ReconProject {
  const query = {
    id: 'q',
    templateId: 't',
    packId: 'p',
    provider: 'mock' as const,
    query: 'site:example.com',
    displayQuery: 'site:example.com',
    explanation: 'Test query',
    category: 'documents',
    tags: ['public'],
    reviewPriority: 'low' as const,
    safetyLevel: 'low' as const,
    resultPolicy: 'in-scope' as const,
    resultHostAllowlist: [],
  };
  const finding = normalizeProviderResult(
    {
      url: 'https://example.com/report',
      title: '=HYPERLINK("bad") <script>alert(1)</script>',
      snippet: '+SUM(1,1)',
    },
    query,
    'mock',
    '2026-01-01T00:00:00.000Z',
  );
  finding.notes = '@cmd';
  return {
    schemaVersion: '1.0',
    id: 'p',
    name: '<img src=x onerror=alert(1)>',
    authorizationStatement: 'Authorized synthetic fixture for example.com.',
    scope: parseScope('example.com'),
    selectedPackIds: ['p'],
    queries: [query],
    findings: [finding],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T01:00:00.000Z',
  };
}

describe('report serialization', () => {
  it.each(['=1+1', '+cmd', '-2+3', '@SUM(A1)', ' leading', '\tformula'])(
    'neutralizes CSV formula value %j',
    (value) => {
      expect(neutralizeCsvFormula(value)).toBe(`'${value}`);
    },
  );

  it('escapes HTML and never renders provider text as markup', () => {
    const bundle = exportProject(fixture());
    expect(bundle.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(bundle.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(bundle.html).not.toContain('<script>alert(1)</script>');
    expect(bundle.html).toContain('Content-Security-Policy');
  });

  it('protects CSV cells and includes report caveats', () => {
    const bundle = exportProject(fixture());
    expect(bundle.csv).toContain("'=HYPERLINK");
    expect(bundle.csv).toContain("'+SUM");
    expect(bundle.markdown).toContain('not proof of a vulnerability');
    expect(bundle.markdown).toContain('Authorization statement');
  });

  it('neutralizes Markdown image and link injection', () => {
    const project = fixture();
    project.findings[0]!.title = 'safe](/x) ![remote](https://attacker.example/pixel)';
    project.findings[0]!.notes = 'line one\n# injected heading';
    const markdown = exportProject(project).markdown;
    expect(markdown).not.toContain('![remote](');
    expect(markdown).not.toContain('\n# injected heading');
    expect(markdown).toContain('\\!\\[remote\\]\\(');
  });

  it('escapes all HTML metacharacters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});
