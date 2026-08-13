import {
  ArrowRight,
  Copy,
  Database,
  FileSearch,
  FolderOpen,
  Layers3,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { validateProjectImport } from '@reconforge/core';
import { Card, PageHeader, Pill } from '../components/ui.js';
import { useProject } from '../state/project-store.js';

export function DashboardPage() {
  const {
    project,
    projects,
    deletedProjects,
    loadDemo,
    selectProject,
    deleteProject,
    duplicateProject,
    restoreLastDeleted,
    importProject,
  } = useProject();
  const navigate = useNavigate();
  const importRef = useRef<HTMLInputElement>(null);
  const [libraryMessage, setLibraryMessage] = useState('');
  const hostCount = new Set(project?.findings.map((item) => item.hostname) ?? []).size;
  const highCount = project?.findings.filter((item) => item.reviewPriority === 'high').length ?? 0;
  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imported = validateProjectImport(await file.text());
      importProject(imported);
      setLibraryMessage(`Imported “${imported.name}” after full schema and scope validation.`);
    } catch (error) {
      setLibraryMessage(error instanceof Error ? error.message : 'Project import failed.');
    }
  };
  return (
    <div className="page dashboard-page">
      <PageHeader
        eyebrow="Passive reconnaissance workspace"
        title="Search intelligence, shaped for review."
        description="Build bounded queries from authorized scopes, preserve provenance, and turn public-search leads into analyst-ready reports."
        action={
          <Link className="button button-primary" to="/new">
            <Plus size={18} />
            New project
          </Link>
        }
      />
      <section className="hero-panel">
        <div className="hero-copy">
          <Pill tone="green">
            <ShieldCheck size={13} /> Local-first planner
          </Pill>
          <h2>Map what search engines can already see.</h2>
          <p>
            ReconForge Web compiles explainable queries, never probes targets, and keeps API
            credentials out of public deployments.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/new">
              Configure a scope <ArrowRight size={17} />
            </Link>
            <button
              className="button button-secondary"
              onClick={() => {
                loadDemo();
                void navigate('/planner');
              }}
            >
              <Sparkles size={17} />
              Load safe demo
            </button>
          </div>
        </div>
        <div className="signal-orbit" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="radar-core">
            <FileSearch />
          </span>
          <span className="signal signal-a" />
          <span className="signal signal-b" />
          <span className="signal signal-c" />
        </div>
      </section>
      <div className="stat-grid">
        <Card>
          <span className="stat-icon cyan">
            <Layers3 />
          </span>
          <div>
            <strong>{project?.queries.length ?? 0}</strong>
            <span>Prepared queries</span>
          </div>
          <small>Deduplicated and provider-aware</small>
        </Card>
        <Card>
          <span className="stat-icon blue">
            <Database />
          </span>
          <div>
            <strong>{project?.findings.length ?? 0}</strong>
            <span>Normalized findings</span>
          </div>
          <small>
            Across {hostCount} public host{hostCount === 1 ? '' : 's'}
          </small>
        </Card>
        <Card>
          <span className="stat-icon amber">
            <ShieldCheck />
          </span>
          <div>
            <strong>{highCount}</strong>
            <span>High review priority</span>
          </div>
          <small>Leads requiring manual validation</small>
        </Card>
      </div>
      <Card className="project-library">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Local project library</span>
            <h2>
              {projects.length} saved project{projects.length === 1 ? '' : 's'}
            </h2>
          </div>
          <div className="library-actions">
            {deletedProjects.length ? (
              <button className="button button-ghost" onClick={restoreLastDeleted}>
                <RotateCcw size={16} /> Restore last deleted
              </button>
            ) : null}
            <button className="button button-secondary" onClick={() => importRef.current?.click()}>
              <Upload size={16} /> Import project JSON
            </button>
            <input
              ref={importRef}
              className="sr-only"
              type="file"
              aria-label="Import project JSON file"
              accept="application/json,.json"
              onChange={(event) => void handleImport(event)}
            />
          </div>
        </div>
        {libraryMessage ? (
          <p className="library-message" role="status">
            {libraryMessage}
          </p>
        ) : null}
        {projects.length ? (
          <div className="project-list">
            {projects.map((item) => (
              <article className={item.id === project?.id ? 'active' : ''} key={item.id}>
                <div className="project-list-main">
                  <FileSearch />
                  <div>
                    <h3>{item.name}</h3>
                    <p>
                      {item.scope.normalized}
                      {item.additionalScopes?.length ? ` +${item.additionalScopes.length}` : ''}
                    </p>
                  </div>
                </div>
                <div className="project-list-meta">
                  <Pill tone={item.id === 'synthetic-example-demo' ? 'green' : 'cyan'}>
                    {item.id === 'synthetic-example-demo' ? 'Synthetic demo' : item.scope.type}
                  </Pill>
                  <span>{item.findings.length} findings</span>
                  <time dateTime={item.updatedAt}>
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </time>
                </div>
                <div className="project-list-actions">
                  <button
                    className="button button-secondary"
                    onClick={() => {
                      selectProject(item.id);
                      void navigate('/planner');
                    }}
                  >
                    <FolderOpen size={16} /> Open
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Duplicate ${item.name}`}
                    title="Duplicate project"
                    onClick={() => duplicateProject(item.id)}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`Delete ${item.name}`}
                    title="Move project to recoverable local trash"
                    onClick={() => deleteProject(item.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No saved projects yet. Create one or load the safe demo.</p>
        )}
      </Card>
      <div className="dashboard-grid">
        <Card className="workflow-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Workflow</span>
              <h2>A defensible path from scope to report</h2>
            </div>
          </div>
          <div className="workflow-list">
            <div>
              <span>01</span>
              <div>
                <b>Parse the scope</b>
                <p>Public Suffix List-backed classification sets hard safety boundaries.</p>
              </div>
            </div>
            <div>
              <span>02</span>
              <div>
                <b>Review query packs</b>
                <p>Every query explains its purpose, compatibility, and safety level.</p>
              </div>
            </div>
            <div>
              <span>03</span>
              <div>
                <b>Normalize evidence</b>
                <p>Canonical URLs, merged provenance, analyst status, notes, and tags.</p>
              </div>
            </div>
            <div>
              <span>04</span>
              <div>
                <b>Export responsibly</b>
                <p>Escaped reports include scope, authorization, limitations, and next steps.</p>
              </div>
            </div>
          </div>
        </Card>
        <Card className="current-card">
          <span className="eyebrow">Current project</span>
          {project ? (
            <>
              <div className="project-glyph">
                <FileSearch />
              </div>
              <h2>{project.name}</h2>
              <p>{project.scope.includedHostnames}</p>
              <div className="project-meta">
                <Pill tone={project.scope.type === 'public-suffix' ? 'amber' : 'cyan'}>
                  {project.scope.type}
                </Pill>
                <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
              </div>
              <Link className="button button-secondary full" to="/planner">
                Open query planner <ArrowRight size={16} />
              </Link>
            </>
          ) : (
            <>
              <div className="project-glyph">
                <Plus />
              </div>
              <h2>No active project</h2>
              <p>
                Start with a strict authorized scope or explore the synthetic example.com
                demonstration.
              </p>
              <Link className="button button-secondary full" to="/new">
                Create project <ArrowRight size={16} />
              </Link>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
