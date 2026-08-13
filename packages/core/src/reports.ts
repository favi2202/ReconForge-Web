import type { ReconProject } from './types.js';

export interface ExportBundle {
  json: string;
  csv: string;
  markdown: string;
  html: string;
  queries: string;
  scopeManifest: string;
}

export function exportProject(project: ReconProject): ExportBundle {
  return {
    json: JSON.stringify(project, null, 2),
    csv: findingsToCsv(project),
    markdown: projectToMarkdown(project),
    html: projectToHtml(project),
    queries: [
      ...(project.id === 'synthetic-example-demo' ? ['# SYNTHETIC DEMO'] : []),
      ...project.queries.map((query) => query.displayQuery),
    ].join('\n'),
    scopeManifest: JSON.stringify(
      {
        schemaVersion: '1.0',
        syntheticDemo: project.id === 'synthetic-example-demo',
        scopes: [project.scope, ...(project.additionalScopes ?? [])],
        authorizationStatement: project.authorizationStatement,
      },
      null,
      2,
    ),
  };
}

export function neutralizeCsvFormula(value: string): string {
  const normalized = value.replace(/\r?\n/gu, ' ');
  return /^[\t\r =+\-@]/u.test(normalized) ? `'${normalized}` : normalized;
}

function csvCell(value: string): string {
  return `"${neutralizeCsvFormula(value).replaceAll('"', '""')}"`;
}

export function findingsToCsv(project: ReconProject): string {
  const headers = [
    'URL',
    'Hostname',
    'Category',
    'Review priority',
    'Status',
    'Title',
    'Snippet',
    'Sources',
    'Tags',
    'Notes',
  ];
  const rows = project.findings.map((finding) =>
    [
      finding.canonicalUrl,
      finding.hostname,
      finding.category,
      finding.reviewPriority,
      finding.status,
      finding.title,
      finding.snippet,
      finding.provenance.map((item) => item.provider).join('; '),
      finding.tags.join('; '),
      finding.notes,
    ]
      .map(csvCell)
      .join(','),
  );
  return [headers.map(csvCell).join(','), ...rows].join('\r\n');
}

function md(value: string): string {
  return value.replace(/\r?\n/gu, ' ').replace(/([\\`*_{}[\]()#+.!|<>-])/gu, '\\$1');
}

export function projectToMarkdown(project: ReconProject): string {
  const scopes = [project.scope, ...(project.additionalScopes ?? [])];
  const grouped = new Map<string, Map<string, typeof project.findings>>();
  for (const finding of project.findings) {
    const categories = grouped.get(finding.hostname) ?? new Map<string, typeof project.findings>();
    categories.set(finding.category, [...(categories.get(finding.category) ?? []), finding]);
    grouped.set(finding.hostname, categories);
  }
  const findings = [...grouped.entries()]
    .map(
      ([host, categories]) =>
        `### ${md(host)}\n\n${[...categories.entries()]
          .map(
            ([category, items]) =>
              `#### ${md(category)}\n\n${items
                .map(
                  (finding) =>
                    `- [${md(finding.title)}](<${finding.canonicalUrl.replaceAll('>', '%3E')}>) — **${finding.reviewPriority} review priority**; status: ${finding.status}; provenance: ${md(finding.provenance.map((item) => `${item.provider} [${item.queryId}] ${item.query}`).join(' | '))}${finding.notes ? `; analyst notes: ${md(finding.notes)}` : ''}`,
                )
                .join('\n')}`,
          )
          .join('\n\n')}`,
    )
    .join('\n\n');
  return `# ReconForge Web analyst report: ${md(project.name)}

## Scope and authorization

${project.id === 'synthetic-example-demo' ? '- Data classification: **SYNTHETIC DEMO**\n' : ''}- Scope${scopes.length === 1 ? '' : 's'}: ${scopes.map((scope) => `\`${md(scope.normalized)}\` (${scope.type})`).join(', ')}
- Included: ${scopes.map((scope) => md(scope.includedHostnames)).join('; ')}
- Exclusions: ${
    scopes.flatMap((scope) => scope.exclusions).length
      ? scopes
          .flatMap((scope) => scope.exclusions)
          .map(md)
          .join(', ')
      : 'None'
  }
- Authorization statement: ${md(project.authorizationStatement)}
- Project created: ${project.createdAt}
- Project last updated: ${project.updatedAt}
- Report exported: ${new Date().toISOString()}
- Providers: ${md([...new Set(project.findings.flatMap((item) => item.provenance.map((p) => p.provider)))].join(', ') || 'Manual/planner mode')}

## Query pack summary

${project.selectedPackIds.map((id) => `- ${md(id)}`).join('\n') || '- No packs selected'}

## Findings (${project.findings.length})

${findings || 'No findings have been imported or collected.'}

## Limitations and next steps

Search results are incomplete, time-dependent, and may be stale or false positives. A high review priority is not proof of a vulnerability. Validate ownership, access expectations, freshness, and exposure manually using an authorized process. ReconForge Web does not perform active validation, download discovered files, or test credentials.
`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function projectToHtml(project: ReconProject): string {
  const scopes = [project.scope, ...(project.additionalScopes ?? [])];
  let previousGroup = '';
  const rows = [...project.findings]
    .sort((a, b) => a.hostname.localeCompare(b.hostname) || a.category.localeCompare(b.category))
    .map((finding) => {
      const group = `${finding.hostname}\u0000${finding.category}`;
      const heading =
        group === previousGroup
          ? ''
          : `<tr class="group"><th colspan="6">${escapeHtml(finding.hostname)} / ${escapeHtml(finding.category)}</th></tr>`;
      previousGroup = group;
      return `${heading}<tr><td><a href="${escapeHtml(finding.canonicalUrl)}" rel="noopener noreferrer">${escapeHtml(
        finding.title,
      )}</a><br><small>${escapeHtml(finding.provenance.map((item) => `${item.provider} [${item.queryId}] ${item.query}`).join(' | '))}</small></td><td>${escapeHtml(finding.hostname)}</td><td>${escapeHtml(finding.category)}</td><td>${escapeHtml(
        finding.reviewPriority,
      )}</td><td>${escapeHtml(finding.status)}</td><td>${escapeHtml(finding.notes)}</td></tr>`;
    })
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><title>${escapeHtml(
    project.name,
  )} — ReconForge Web report</title><style>body{font:16px system-ui;background:#08111f;color:#dce8f5;max-width:1100px;margin:auto;padding:32px}a{color:#5ee7f7}table{width:100%;border-collapse:collapse}th,td{padding:10px;border:1px solid #29405a;text-align:left}.group th{background:#12243a;color:#8ce9f3}small{color:#9cb0c5}</style></head><body><h1>${escapeHtml(
    project.name,
  )}</h1>${project.id === 'synthetic-example-demo' ? '<p><strong>SYNTHETIC DEMO — no real target data</strong></p>' : ''}<p><strong>Scope${scopes.length === 1 ? '' : 's'}:</strong> ${scopes.map((scope) => `${escapeHtml(scope.normalized)} (${escapeHtml(scope.type)})`).join(', ')}</p><p><strong>Authorization:</strong> ${escapeHtml(
    project.authorizationStatement,
  )}</p><p><strong>Project period:</strong> ${escapeHtml(project.createdAt)} — ${escapeHtml(project.updatedAt)}</p><p><strong>Report exported:</strong> ${escapeHtml(new Date().toISOString())}</p><table><thead><tr><th>Finding & provenance</th><th>Host</th><th>Category</th><th>Review priority</th><th>Status</th><th>Analyst notes</th></tr></thead><tbody>${rows}</tbody></table><p><small>Search findings may be stale or false positives. Review priority is not proof of vulnerability. Perform only authorized manual validation.</small></p></body></html>`;
}
