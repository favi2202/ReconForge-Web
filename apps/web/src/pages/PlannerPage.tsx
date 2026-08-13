import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Copy,
  Eye,
  FileSearch,
  Filter,
  LockKeyhole,
  SlidersHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  browserSearchUrl,
  buildVisualQuery,
  compileQueriesForScopes,
  type ProviderId,
  type QueryPack,
} from '@reconforge/core';
import { packs, publicSuffixPackIds, templatesForPacks } from '@reconforge/templates';
import { Button, Card, EmptyState, PageHeader, Pill, Priority } from '../components/ui.js';
import { useProject } from '../state/project-store.js';

const browserProviders: Array<{ id: ProviderId; label: string }> = [
  { id: 'google-link', label: 'Google browser' },
  { id: 'bing-link', label: 'Bing browser' },
  { id: 'duckduckgo-link', label: 'DuckDuckGo browser' },
  { id: 'brave', label: 'Brave Search' },
];

export function PlannerPage() {
  const { project, mutateProject } = useProject();
  const [provider, setProvider] = useState<ProviderId>('google-link');
  const [authorized, setAuthorized] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [category, setCategory] = useState('all');
  const [phrase, setPhrase] = useState('');
  const [inurl, setInurl] = useState('');
  const [builderError, setBuilderError] = useState('');
  if (!project)
    return (
      <div className="page">
        <EmptyState
          icon={<FileSearch />}
          title="Create a project first"
          description="The planner needs a parsed, authorized scope before it can compile queries."
          action={
            <Link className="button button-primary" to="/new">
              Configure scope
            </Link>
          }
        />
      </div>
    );

  const projectScopes = [project.scope, ...(project.additionalScopes ?? [])];

  const allowedPacks =
    project.scope.type === 'public-suffix'
      ? packs.filter((pack) => publicSuffixPackIds().includes(pack.id))
      : packs;
  const selected = new Set(project.selectedPackIds);
  const packCompatibility = (pack: QueryPack) => {
    const compatible = templatesForPacks([pack.id]).some(
      (template) =>
        projectScopes.some((scope) => template.supportedScopeTypes.includes(scope.type)) &&
        template.providers.includes(provider),
    );
    if (!compatible) return 'No templates in this pack support the active scope and provider.';
    if (pack.safetyLevel !== 'low' && !authorized)
      return 'Confirm explicit authorization to enable guarded or sensitive templates.';
    if (
      pack.safetyLevel === 'sensitive' &&
      !projectScopes.every((scope) => scope.allowsSensitivePack)
    )
      return 'Sensitive templates require exact-domain scopes.';
    return null;
  };
  const queries = compileQueriesForScopes(
    projectScopes,
    templatesForPacks(project.selectedPackIds),
    { provider, authorizationConfirmed: authorized },
  );
  const categories = ['all', ...new Set(queries.map((query) => query.category))];
  const shown =
    category === 'all' ? queries : queries.filter((query) => query.category === category);
  const togglePack = (pack: QueryPack) => {
    if (packCompatibility(pack)) return;
    const next = selected.has(pack.id)
      ? project.selectedPackIds.filter((id) => id !== pack.id)
      : [...project.selectedPackIds, pack.id];
    const compiled = compileQueriesForScopes(projectScopes, templatesForPacks(next), {
      provider,
      authorizationConfirmed: authorized,
    });
    mutateProject((current) => ({
      ...current,
      selectedPackIds: next,
      queries: compiled,
      updatedAt: new Date().toISOString(),
    }));
  };
  const copy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    setTimeout(() => setCopied(null), 1300);
  };
  const addCustom = () => {
    try {
      const query = buildVisualQuery(project.scope, provider, {
        ...(phrase ? { phrase } : {}),
        ...(inurl ? { inurl } : {}),
      });
      void copy('custom', query);
      setBuilderError('');
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : 'Custom query is invalid.');
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Query intelligence"
        title="Preview every search before it leaves."
        description="Templates are typed, scoped, provider-aware, deduplicated, and explained. Opening a search always happens in your browser."
        action={
          <Link
            className={`button button-primary ${project.scope.type === 'public-suffix' || projectScopes.length > 1 ? 'disabled' : ''}`}
            aria-disabled={project.scope.type === 'public-suffix' || projectScopes.length > 1}
            tabIndex={project.scope.type === 'public-suffix' || projectScopes.length > 1 ? -1 : 0}
            onClick={(event) => {
              if (project.scope.type === 'public-suffix' || projectScopes.length > 1)
                event.preventDefault();
            }}
            to="/run"
          >
            Connected run <ArrowUpRight size={17} />
          </Link>
        }
      />
      {project.scope.warning ? (
        <div className="banner warning">
          <AlertTriangle />
          <div>
            <b>Broad public-suffix scope</b>
            <p>{project.scope.warning} Connected execution is disabled.</p>
          </div>
        </div>
      ) : null}
      <Card className="scope-bar">
        <div>
          <span className="eyebrow">Compiled boundary</span>
          <h2>
            {project.scope.normalized}
            {project.additionalScopes?.length ? ` +${project.additionalScopes.length}` : ''}
          </h2>
          <p>
            {projectScopes.length > 1
              ? `${projectScopes.length} exact authorized domains`
              : project.scope.includedHostnames}
          </p>
          {project.id === 'synthetic-example-demo' ? (
            <Pill tone="green">Synthetic demo</Pill>
          ) : null}
        </div>
        <dl>
          <div>
            <dt>Scope type</dt>
            <dd>{projectScopes.length > 1 ? 'authorized-list' : project.scope.type}</dd>
          </div>
          <div>
            <dt>Breadth</dt>
            <dd>
              {projectScopes.length > 1
                ? 'Bounded list'
                : project.scope.type === 'exact-domain'
                  ? 'Narrow'
                  : project.scope.type === 'subdomain-tree'
                    ? 'Moderate'
                    : 'Broad'}
            </dd>
          </div>
          <div>
            <dt>Estimated queries</dt>
            <dd>
              {queries.length} / {projectScopes.length > 1 ? 100 : project.scope.hardQueryLimit}
            </dd>
          </div>
        </dl>
      </Card>
      <div className="planner-layout">
        <aside className="pack-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Reconnaissance packs</span>
              <h2>Select intent</h2>
            </div>
            <Pill tone="cyan">
              {
                allowedPacks.filter((pack) => selected.has(pack.id) && !packCompatibility(pack))
                  .length
              }{' '}
              effective
            </Pill>
          </div>
          <div className="pack-list">
            {allowedPacks.map((pack) => {
              const active = selected.has(pack.id);
              const lockReason = packCompatibility(pack);
              const locked = Boolean(lockReason);
              return (
                <button
                  key={pack.id}
                  type="button"
                  disabled={locked}
                  className={`pack-item ${active && !locked ? 'selected' : ''}`}
                  title={lockReason ?? pack.description}
                  onClick={() => togglePack(pack)}
                >
                  <span className="pack-check">
                    {locked ? <LockKeyhole size={15} /> : active ? <Check size={15} /> : null}
                  </span>
                  <span>
                    <b>{pack.name}</b>
                    <small>{pack.description}</small>
                    {lockReason ? <small className="field-error">{lockReason}</small> : null}
                  </span>
                  <Pill
                    tone={
                      pack.safetyLevel === 'sensitive'
                        ? 'red'
                        : pack.safetyLevel === 'guarded'
                          ? 'amber'
                          : 'green'
                    }
                  >
                    {pack.safetyLevel}
                  </Pill>
                </button>
              );
            })}
          </div>
          {projectScopes.every((scope) => scope.allowsSensitivePack) ? (
            <label className="check-row compact">
              <input
                type="checkbox"
                checked={authorized}
                onChange={(event) => setAuthorized(event.target.checked)}
              />
              <span>
                <b>Explicit authorization confirmed</b>
                <small>
                  Unlocks guarded and Sensitive Exposure Review templates. Sensitive previews remain
                  redacted.
                </small>
              </span>
            </label>
          ) : null}
        </aside>
        <section className="query-workspace">
          <div className="query-toolbar">
            <label>
              Search engine
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value as ProviderId)}
              >
                {browserProviders.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item === 'all' ? 'All categories' : item}
                  </option>
                ))}
              </select>
            </label>
            <span className="query-count">
              <Filter size={15} />
              {shown.length} queries
            </span>
          </div>
          <Card className="visual-builder">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Visual builder</span>
                <h2>
                  <SlidersHorizontal size={19} /> Compose without operator injection
                </h2>
              </div>
            </div>
            <div className="builder-fields">
              <label>
                Exact phrase
                <input
                  value={phrase}
                  maxLength={80}
                  placeholder="public roadmap"
                  onChange={(event) => setPhrase(event.target.value)}
                />
              </label>
              <label>
                URL contains
                <input
                  value={inurl}
                  maxLength={80}
                  placeholder="resources"
                  onChange={(event) => setInurl(event.target.value)}
                />
              </label>
              <Button type="button" variant="secondary" onClick={addCustom}>
                {copied === 'custom' ? <Check size={16} /> : <Copy size={16} />} Compile & copy
              </Button>
            </div>
            {builderError ? <small className="field-error">{builderError}</small> : null}
          </Card>
          <div className="query-list">
            {shown.map((query, index) => (
              <Card key={query.id} className="query-card">
                <div className="query-card-top">
                  <span className="query-number">Q{String(index + 1).padStart(2, '0')}</span>
                  <div className="query-tags">
                    <Pill
                      tone={
                        query.safetyLevel === 'sensitive'
                          ? 'red'
                          : query.safetyLevel === 'guarded'
                            ? 'amber'
                            : 'green'
                      }
                    >
                      {query.safetyLevel}
                    </Pill>
                    <Priority value={query.reviewPriority} />
                  </div>
                </div>
                <code>{query.displayQuery}</code>
                <div className="query-explanation">
                  <Eye size={16} />
                  <p>{query.explanation}</p>
                </div>
                <div className="query-card-bottom">
                  <span>
                    {query.category} · {query.provider}
                  </span>
                  <div>
                    <Button
                      variant="ghost"
                      aria-label="Copy query"
                      onClick={() => void copy(query.id, query.query)}
                    >
                      {copied === query.id ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copied === query.id ? 'Copied' : 'Copy'}</span>
                    </Button>
                    <a
                      className="button button-secondary"
                      href={browserSearchUrl(provider, query.query)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open search <ArrowUpRight size={15} />
                    </a>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
