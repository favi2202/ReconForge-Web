import { Download, FileJson, FileOutput, FileSpreadsheet, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { exportProject } from '@reconforge/core';
import { Button, Card, EmptyState, PageHeader, Pill } from '../components/ui.js';
import { downloadText } from '../lib/download.js';
import { useProject } from '../state/project-store.js';

export function ReportsPage() {
  const { project } = useProject();
  const [exportStatus, setExportStatus] = useState('');
  if (!project)
    return (
      <div className="page">
        <EmptyState
          icon={<FileOutput />}
          title="No reportable project"
          description="Create a project, plan queries, and collect or import findings first."
          action={
            <Link className="button button-primary" to="/new">
              Create project
            </Link>
          }
        />
      </div>
    );
  const bundle = exportProject(project);
  const base =
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-|-$/gu, '')
      .slice(0, 60) || 'reconforge-report';
  const formats = [
    [
      'JSON project',
      'Complete versioned project schema',
      FileJson,
      `${base}.json`,
      bundle.json,
      'application/json',
    ],
    [
      'CSV findings',
      'Formula-neutralized spreadsheet import',
      FileSpreadsheet,
      `${base}.csv`,
      bundle.csv,
      'text/csv',
    ],
    [
      'Markdown report',
      'Analyst-ready portable narrative',
      FileOutput,
      `${base}.md`,
      bundle.markdown,
      'text/markdown',
    ],
    [
      'Standalone HTML',
      'Escaped, CSP-restricted offline report',
      FileOutput,
      `${base}.html`,
      bundle.html,
      'text/html',
    ],
    [
      'Query list',
      'One redacted or standard query per line',
      FileOutput,
      `${base}-queries.txt`,
      bundle.queries,
      'text/plain',
    ],
    [
      'Scope manifest',
      'Boundary and authorization record',
      LockKeyhole,
      `${base}-scope.json`,
      bundle.scopeManifest,
      'application/json',
    ],
  ] as const;
  const download = (filename: string, contents: string, type: string) => {
    downloadText(filename, contents, type);
    setExportStatus(`Downloaded ${filename}.`);
  };
  return (
    <div className="page">
      <PageHeader
        eyebrow={
          project.id === 'synthetic-example-demo' ? 'Synthetic demo · Reporting' : 'Reporting'
        }
        title="Export the scope, evidence, and caveats."
        description="Every report carries authorization context, provenance, limitations, and responsible next steps. Credentials are never part of the project schema."
      />
      <div className="report-summary">
        <Card>
          <span className="eyebrow">Report snapshot</span>
          <h2>{project.name}</h2>
          <div className="report-scope">
            <code>
              {project.scope.normalized}
              {project.additionalScopes?.length ? ` +${project.additionalScopes.length}` : ''}
            </code>
            <Pill tone={project.id === 'synthetic-example-demo' ? 'green' : 'cyan'}>
              {project.id === 'synthetic-example-demo' ? 'SYNTHETIC DEMO' : project.scope.type}
            </Pill>
          </div>
          <dl className="scope-details">
            <div>
              <dt>Findings</dt>
              <dd>{project.findings.length}</dd>
            </div>
            <div>
              <dt>Hostnames</dt>
              <dd>{new Set(project.findings.map((item) => item.hostname)).size}</dd>
            </div>
            <div>
              <dt>Queries</dt>
              <dd>{project.queries.length}</dd>
            </div>
            <div>
              <dt>Packs</dt>
              <dd>{project.selectedPackIds.length}</dd>
            </div>
          </dl>
          <p className="authorization-box">
            <LockKeyhole size={17} />
            {project.authorizationStatement}
          </p>
        </Card>
        <Card className="export-grid-card">
          <span className="eyebrow">Available exports</span>
          <div className="export-grid">
            {formats.map(([name, description, Icon, filename, contents, type]) => (
              <button
                key={name}
                className="export-option"
                onClick={() => download(filename, contents, type)}
              >
                <span>
                  <Icon />
                </span>
                <div>
                  <b>{name}</b>
                  <small>{description}</small>
                </div>
                <Download size={17} />
              </button>
            ))}
          </div>
          <p className="library-message" role="status">
            {exportStatus}
          </p>
        </Card>
      </div>
      <Card className="report-preview">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Markdown preview</span>
            <h2>Analyst narrative</h2>
          </div>
          <Button
            variant="secondary"
            onClick={() => download(`${base}.md`, bundle.markdown, 'text/markdown')}
          >
            <Download size={16} />
            Download
          </Button>
        </div>
        <pre tabIndex={0} role="region" aria-label="Scrollable Markdown report preview">
          {bundle.markdown}
        </pre>
      </Card>
    </div>
  );
}
