import {
  AlertTriangle,
  Boxes,
  Check,
  Copy,
  ExternalLink,
  Filter,
  LayoutGrid,
  List,
  Plus,
  Search,
  Tags,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  canonicalizeUrl,
  deduplicateFindings,
  isProviderResultAllowed,
  normalizeProviderResult,
  type Finding,
} from '@reconforge/core';
import { Button, Card, EmptyState, PageHeader, Pill, Priority } from '../components/ui.js';
import { useProject } from '../state/project-store.js';

export function ResultsPage() {
  const { project, mutateProject } = useProject();
  const [search, setSearch] = useState('');
  const [host, setHost] = useState('all');
  const [category, setCategory] = useState('all');
  const [source, setSource] = useState('all');
  const [priority, setPriority] = useState('all');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [grouping, setGrouping] = useState<'none' | 'hostname' | 'rootDomain'>('none');
  const [after, setAfter] = useState('');
  const [manual, setManual] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [copied, setCopied] = useState('');
  const findings = useMemo(() => project?.findings ?? [], [project]);
  const hosts = [...new Set(findings.map((item) => item.hostname))].sort();
  const categories = [...new Set(findings.map((item) => item.category))].sort();
  const sources = [...new Set(findings.map((item) => item.source))].sort();
  const filtered = useMemo(
    () =>
      findings.filter((item) => {
        const needle = search.toLowerCase();
        return (
          (!needle ||
            `${item.title} ${item.url} ${item.snippet} ${item.notes} ${item.tags.join(' ')}`
              .toLowerCase()
              .includes(needle)) &&
          (host === 'all' || item.hostname === host) &&
          (category === 'all' || item.category === category) &&
          (source === 'all' || item.source === source) &&
          (priority === 'all' || item.reviewPriority === priority) &&
          (status === 'all' || item.status === status) &&
          (!after || item.firstSeenAt.slice(0, 10) >= after)
        );
      }),
    [findings, search, host, category, source, priority, status, after],
  );
  const grouped = useMemo(() => {
    const groups = new Map<string, Finding[]>();
    for (const finding of filtered) {
      const key =
        grouping === 'hostname'
          ? finding.hostname
          : grouping === 'rootDomain'
            ? (finding.rootDomain ?? 'Unknown root domain')
            : 'All findings';
      groups.set(key, [...(groups.get(key) ?? []), finding]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, grouping]);
  if (!project)
    return (
      <div className="page">
        <EmptyState
          icon={<Boxes />}
          title="No results workspace yet"
          description="Create a project or load the synthetic demonstration to explore normalized findings."
          action={
            <Link className="button button-primary" to="/">
              Open dashboard
            </Link>
          }
        />
      </div>
    );
  const updateFinding = (id: string, update: Partial<Finding>) =>
    mutateProject((current) => ({
      ...current,
      findings: current.findings.map((item) => (item.id === id ? { ...item, ...update } : item)),
      updatedAt: new Date().toISOString(),
    }));
  const importManual = () => {
    const lines = manual
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (!project.queries.length) {
      setImportMessage('Generate at least one query before importing results.');
      return;
    }
    const added: Finding[] = [];
    for (const line of lines) {
      const [url, title = 'Manually imported result', snippet = ''] = line
        .split('|')
        .map((value) => value.trim());
      if (!url) continue;
      try {
        canonicalizeUrl(url);
        const raw = { url, title, snippet };
        const scopes = [project.scope, ...(project.additionalScopes ?? [])];
        const match = project.queries
          .flatMap((query) =>
            scopes
              .filter(
                (scope) =>
                  query.query.toLowerCase().includes(scope.value) &&
                  isProviderResultAllowed(raw, query, scope),
              )
              .map((scope) => ({ query, scope })),
          )
          .at(0);
        if (!match) continue;
        added.push(normalizeProviderResult(raw, match.query, 'manual-import'));
      } catch {
        /* Invalid URLs are counted below without rendering them. */
      }
    }
    const before = project.findings.length;
    const merged = deduplicateFindings([
      ...project.findings.map((item) => ({
        ...item,
        provenance: [...item.provenance],
        tags: [...item.tags],
      })),
      ...added,
    ]).slice(0, 5_000);
    mutateProject((current) => ({
      ...current,
      findings: merged,
      updatedAt: new Date().toISOString(),
    }));
    const uniqueCount = merged.length;
    setImportMessage(
      `Accepted ${uniqueCount - before} new result${uniqueCount - before === 1 ? '' : 's'}; rejected or merged ${lines.length - (uniqueCount - before)}.`,
    );
    setManual('');
  };
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(''), 1200);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow={
          project.id === 'synthetic-example-demo'
            ? 'Synthetic demo · Results explorer'
            : 'Results explorer'
        }
        title="Review evidence, not assumptions."
        description="Every finding preserves its search provenance. Review priority helps triage; it is never presented as proof of a vulnerability."
        action={
          <Button onClick={() => setShowImport((value) => !value)}>
            <Plus size={17} />
            Manual import
          </Button>
        }
      />
      <div className="result-stats">
        <Card>
          <b>{project.findings.length}</b>
          <span>Total findings</span>
        </Card>
        <Card>
          <b>{hosts.length}</b>
          <span>Unique hosts</span>
        </Card>
        <Card>
          <b>{project.findings.filter((item) => item.status === 'validated').length}</b>
          <span>Validated leads</span>
        </Card>
        <Card>
          <b>{project.findings.filter((item) => item.status === 'false-positive').length}</b>
          <span>False positives</span>
        </Card>
      </div>
      {showImport ? (
        <Card className="manual-import">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Manual result import</span>
              <h2>Paste up to 100 public result rows</h2>
            </div>
          </div>
          <p>
            One line per result: <code>URL | optional title | optional plain-text snippet</code>.
            Only HTTP(S) URLs are accepted; content is always rendered as text.
          </p>
          <textarea
            rows={5}
            maxLength={100_000}
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="https://docs.example.com/api | Example API docs | Synthetic public documentation"
          />
          <div className="import-actions">
            <span>{importMessage}</span>
            <Button disabled={!manual.trim()} onClick={importManual}>
              Validate & import
            </Button>
          </div>
        </Card>
      ) : null}
      <Card className="filter-bar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search findings"
            placeholder="Search URL, title, snippet, tag, or note"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Host</span>
          <select value={host} onChange={(event) => setHost(event.target.value)}>
            <option value="all">All hosts</option>
            {hosts.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="reviewing">Reviewing</option>
            <option value="validated">Validated</option>
            <option value="false-positive">False positive</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Priority</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="all">All priorities</option>
            <option>high</option>
            <option>medium</option>
            <option>low</option>
            <option>informational</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Source</span>
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="all">All sources</option>
            {sources.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="date-filter">
          <span>Seen after</span>
          <input type="date" value={after} onChange={(event) => setAfter(event.target.value)} />
        </label>
        <span className="query-count">
          <Filter size={15} />
          {filtered.length} shown
        </span>
      </Card>
      <div className="result-viewbar">
        <label>
          Group results
          <select
            value={grouping}
            onChange={(event) =>
              setGrouping(event.target.value as 'none' | 'hostname' | 'rootDomain')
            }
          >
            <option value="none">No grouping</option>
            <option value="hostname">Hostname</option>
            <option value="rootDomain">Root domain</option>
          </select>
        </label>
        <div role="group" aria-label="Result view">
          <Button
            variant={view === 'table' ? 'secondary' : 'ghost'}
            aria-pressed={view === 'table'}
            onClick={() => setView('table')}
          >
            <List size={16} /> Table
          </Button>
          <Button
            variant={view === 'cards' ? 'secondary' : 'ghost'}
            aria-pressed={view === 'cards'}
            onClick={() => setView('cards')}
          >
            <LayoutGrid size={16} /> Cards
          </Button>
        </div>
      </div>
      {filtered.length ? (
        view === 'table' ? (
          <div className="results-table-wrap">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>Host / source</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Analyst notes</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {grouped.flatMap(([group, items]) => [
                  ...(grouping !== 'none'
                    ? [
                        <tr className="result-group-row" key={`group-${group}`}>
                          <th colSpan={6}>
                            {group} · {items.length} finding{items.length === 1 ? '' : 's'}
                          </th>
                        </tr>,
                      ]
                    : []),
                  ...items.map((finding) => (
                    <tr key={finding.id}>
                      <td data-label="Finding">
                        <a
                          className="finding-title"
                          href={finding.canonicalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {finding.title}
                          <ExternalLink size={13} />
                        </a>
                        <code>{finding.canonicalUrl}</code>
                        <p>{finding.snippet}</p>
                        <div className="tag-row">
                          {finding.tags.map((tag) => (
                            <Pill key={tag}>{tag}</Pill>
                          ))}
                        </div>
                      </td>
                      <td data-label="Host / source">
                        <b>{finding.hostname}</b>
                        <small>{finding.provenance.map((item) => item.provider).join(', ')}</small>
                        <small>{new Date(finding.firstSeenAt).toLocaleDateString()}</small>
                        <details className="provenance-details">
                          <summary>
                            {finding.provenance.length} evidence record
                            {finding.provenance.length === 1 ? '' : 's'}
                          </summary>
                          {finding.provenance.map((item) => (
                            <div key={`${item.provider}-${item.queryId}`}>
                              <b>{item.provider}</b>
                              <time dateTime={item.collectedAt}>
                                {new Date(item.collectedAt).toLocaleString()}
                              </time>
                              <code>{item.query}</code>
                            </div>
                          ))}
                        </details>
                      </td>
                      <td data-label="Priority">
                        <Priority value={finding.reviewPriority} />
                        <small>{finding.category}</small>
                      </td>
                      <td data-label="Status">
                        <select
                          aria-label={`Status for ${finding.title}`}
                          value={finding.status}
                          onChange={(event) =>
                            updateFinding(finding.id, {
                              status: event.target.value as Finding['status'],
                            })
                          }
                        >
                          <option value="unreviewed">Unreviewed</option>
                          <option value="reviewing">Reviewing</option>
                          <option value="validated">Validated</option>
                          <option value="false-positive">False positive</option>
                        </select>
                      </td>
                      <td data-label="Analyst notes">
                        <textarea
                          aria-label={`Notes for ${finding.title}`}
                          rows={3}
                          maxLength={5000}
                          value={finding.notes}
                          placeholder="Add validation context…"
                          onChange={(event) =>
                            updateFinding(finding.id, { notes: event.target.value })
                          }
                        />
                        <div className="tag-editor">
                          <Tags size={14} />
                          <input
                            aria-label={`Tags for ${finding.title}`}
                            value={finding.tags.join(', ')}
                            onChange={(event) =>
                              updateFinding(finding.id, {
                                tags: event.target.value
                                  .split(',')
                                  .map((item) => item.trim())
                                  .filter(Boolean)
                                  .slice(0, 30),
                              })
                            }
                          />
                        </div>
                      </td>
                      <td data-label="Actions">
                        <Button
                          variant="ghost"
                          aria-label={`Copy ${finding.hostname}`}
                          onClick={() => void copy(finding.hostname)}
                        >
                          {copied === finding.hostname ? <Check size={16} /> : <Copy size={16} />}
                        </Button>
                      </td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="finding-groups">
            {grouped.map(([group, items]) => (
              <section key={group} aria-labelledby={`group-${group.replace(/[^a-z0-9]/giu, '-')}`}>
                {grouping !== 'none' ? (
                  <div className="finding-group-heading">
                    <h2 id={`group-${group.replace(/[^a-z0-9]/giu, '-')}`}>{group}</h2>
                    <Pill tone="cyan">{items.length} findings</Pill>
                  </div>
                ) : null}
                <div className="finding-card-grid">
                  {items.map((finding) => (
                    <Card className="finding-card" key={finding.id}>
                      <div className="finding-card-head">
                        <Priority value={finding.reviewPriority} />
                        <select
                          aria-label={`Status for ${finding.title}`}
                          value={finding.status}
                          onChange={(event) =>
                            updateFinding(finding.id, {
                              status: event.target.value as Finding['status'],
                            })
                          }
                        >
                          <option value="unreviewed">Unreviewed</option>
                          <option value="reviewing">Reviewing</option>
                          <option value="validated">Validated</option>
                          <option value="false-positive">False positive</option>
                        </select>
                      </div>
                      <a
                        className="finding-title"
                        href={finding.canonicalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {finding.title} <ExternalLink size={13} />
                      </a>
                      <code>{finding.canonicalUrl}</code>
                      <p>{finding.snippet}</p>
                      <div className="finding-card-meta">
                        <span>{finding.hostname}</span>
                        <span>{finding.source}</span>
                        <span>{finding.category}</span>
                      </div>
                      <details className="provenance-details">
                        <summary>
                          {finding.provenance.length} evidence record
                          {finding.provenance.length === 1 ? '' : 's'}
                        </summary>
                        {finding.provenance.map((item) => (
                          <div key={`${item.provider}-${item.queryId}`}>
                            <b>{item.provider}</b>
                            <time dateTime={item.collectedAt}>
                              {new Date(item.collectedAt).toLocaleString()}
                            </time>
                            <code>{item.query}</code>
                          </div>
                        ))}
                      </details>
                      <textarea
                        aria-label={`Notes for ${finding.title}`}
                        rows={3}
                        maxLength={5000}
                        value={finding.notes}
                        placeholder="Add validation context…"
                        onChange={(event) =>
                          updateFinding(finding.id, { notes: event.target.value })
                        }
                      />
                      <div className="tag-editor">
                        <Tags size={14} />
                        <input
                          aria-label={`Tags for ${finding.title}`}
                          value={finding.tags.join(', ')}
                          onChange={(event) =>
                            updateFinding(finding.id, {
                              tags: event.target.value
                                .split(',')
                                .map((item) => item.trim())
                                .filter(Boolean)
                                .slice(0, 30),
                            })
                          }
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon={<List />}
          title="No findings match these filters"
          description="Adjust the filters, import public results manually, or run the synthetic provider."
        />
      )}
      <div className="false-positive-note">
        <AlertTriangle size={17} />
        <span>
          Search indexes are incomplete and time-dependent. Validate each lead with the asset owner
          before drawing conclusions.
        </span>
      </div>
    </div>
  );
}
