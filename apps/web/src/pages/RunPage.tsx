import {
  AlertCircle,
  CheckCircle2,
  CircleStop,
  Cloud,
  LoaderCircle,
  Play,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { deduplicateFindings, findingSchema, type Finding } from '@reconforge/core';
import { templatesForPacks } from '@reconforge/templates';
import { Button, Card, EmptyState, PageHeader, Pill } from '../components/ui.js';
import {
  apiRequest,
  ApiRequestError,
  loadConnectedSettings,
  type ConnectedRun,
} from '../lib/connected-api.js';
import { useProject } from '../state/project-store.js';

export function RunPage() {
  const { project, mutateProject } = useProject();
  const [provider, setProvider] = useState<'mock' | 'brave'>('mock');
  const [confirmed, setConfirmed] = useState(false);
  const [run, setRun] = useState<ConnectedRun | null>(() => readStoredRun());
  const [error, setError] = useState('');
  const pollRef = useRef<number | null>(null);
  const settings = loadConnectedSettings();
  const configured = Boolean(settings.token && settings.apiUrl);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    },
    [],
  );
  useEffect(() => {
    if (!project || !run?.scope || run.scope.normalized === project.scope.normalized) return;
    setRun(null);
    sessionStorage.removeItem(RUN_STORAGE_KEY);
  }, [project, run]);
  useEffect(() => {
    if (!project || !configured || !run || (run.status !== 'queued' && run.status !== 'running'))
      return;
    void poll(run.id);
    // poll schedules its own bounded continuation; this only restores a session after navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, configured]);
  if (!project)
    return (
      <div className="page">
        <EmptyState
          icon={<Radio />}
          title="No runnable project"
          description="Create and preview a project before starting a connected owner-mode run."
          action={
            <Link className="button button-primary" to="/new">
              Create project
            </Link>
          }
        />
      </div>
    );
  const broad = project.scope.type === 'public-suffix';
  const scopeList = Boolean(project.additionalScopes?.length);

  function saveRun(next: ConnectedRun) {
    setRun(next);
    sessionStorage.setItem(RUN_STORAGE_KEY, JSON.stringify(next));
  }
  async function poll(id: string) {
    try {
      const next = await apiRequest<ConnectedRun>(settings, `v1/runs/${id}`);
      saveRun(next);
      if (next.status === 'queued' || next.status === 'running')
        pollRef.current = window.setTimeout(() => void poll(id), 3_000);
      else if (next.findings.length) {
        const safe = next.findings.flatMap((value) => {
          const parsed = findingSchema.safeParse(value);
          return parsed.success ? [parsed.data] : [];
        });
        mutateProject((current) => ({
          ...current,
          findings: mergeFindings(current.findings, safe),
          updatedAt: new Date().toISOString(),
        }));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to read run status.');
      if (cause instanceof ApiRequestError && cause.status === 429) {
        pollRef.current = window.setTimeout(
          () => void poll(id),
          Math.max(5_000, cause.retryAfterMs ?? 0),
        );
      }
    }
  }
  const start = async () => {
    setError('');
    try {
      const templateIds = templatesForPacks(project.selectedPackIds).map((template) => template.id);
      const created = await apiRequest<ConnectedRun>(settings, 'v1/runs', {
        method: 'POST',
        body: JSON.stringify({
          scope: project.scope.normalized,
          exclusions: project.scope.exclusions,
          templateIds,
          provider,
          maximumResults: 50,
          authorizationConfirmed: confirmed,
          authorizationStatement: project.authorizationStatement,
        }),
      });
      saveRun(created);
      void poll(created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start run.');
    }
  };
  const cancel = async () => {
    if (!run) return;
    try {
      const next = await apiRequest<ConnectedRun>(settings, `v1/runs/${run.id}`, {
        method: 'DELETE',
      });
      saveRun(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to cancel run.');
    }
  };
  const progress =
    run && run.progress.totalQueries
      ? Math.round((run.progress.completedQueries / run.progress.totalQueries) * 100)
      : 0;

  return (
    <div className="page narrow-page">
      <PageHeader
        eyebrow="Connected owner mode"
        title="Run a bounded provider collection."
        description="The backend re-parses your scope and recompiles catalog template IDs. It never accepts raw search queries or arbitrary fetch URLs."
      />
      {!configured ? (
        <div className="banner info">
          <Cloud />
          <div>
            <b>Connected settings are not configured</b>
            <p>
              Add the API URL and owner access token in Provider settings. Tokens remain in this
              browser tab only.
            </p>
          </div>
          <Link className="button button-secondary" to="/settings">
            Open settings
          </Link>
        </div>
      ) : null}
      {broad ? (
        <div className="banner warning">
          <AlertCircle />
          <div>
            <b>Execution blocked for {project.scope.normalized}</b>
            <p>
              Public-suffix scopes are planner-only. Preview individual low-risk queries and open
              them manually.
            </p>
          </div>
        </div>
      ) : null}
      {scopeList ? (
        <div className="banner warning">
          <AlertCircle />
          <div>
            <b>Connected execution uses one scope per run</b>
            <p>
              This manual list remains fully available in planner mode. Create separate connected
              runs so every domain keeps an independent budget and authorization decision.
            </p>
          </div>
        </div>
      ) : null}
      <div className="run-grid">
        <Card>
          <span className="eyebrow">Run contract</span>
          <h2>{project.name}</h2>
          <dl className="scope-details">
            <div>
              <dt>Scope</dt>
              <dd>{project.scope.normalized}</dd>
            </div>
            <div>
              <dt>Templates</dt>
              <dd>{templatesForPacks(project.selectedPackIds).length}</dd>
            </div>
            <div>
              <dt>Max results</dt>
              <dd>50</dd>
            </div>
            <div>
              <dt>Collection</dt>
              <dd>Passive search metadata</dd>
            </div>
          </dl>
          <label>
            Provider
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as 'mock' | 'brave')}
            >
              <option value="mock">Synthetic mock (offline)</option>
              <option value="brave">Brave Search API</option>
            </select>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              <b>Confirm this exact run is authorized</b>
              <small>
                Required for guarded and sensitive catalog templates. The statement saved with the
                project is sent, never logged.
              </small>
            </span>
          </label>
          <Button
            className="full"
            disabled={!configured || broad || scopeList || !confirmed || run?.status === 'running'}
            onClick={() => void start()}
          >
            <Play size={17} />
            Start authenticated run
          </Button>
        </Card>
        <Card className="run-progress">
          <span className="eyebrow">Live progress</span>
          {run ? (
            <div aria-live="polite">
              <div className={`run-state ${run.status}`}>
                <span>
                  {run.status === 'running' || run.status === 'queued' ? (
                    <LoaderCircle className="spin" />
                  ) : run.status === 'completed' ? (
                    <CheckCircle2 />
                  ) : (
                    <AlertCircle />
                  )}
                </span>
                <div>
                  <h2>{run.status}</h2>
                  <p>
                    {run.progress.completedQueries} of {run.progress.totalQueries} queries completed
                  </p>
                </div>
                <Pill
                  tone={
                    run.status === 'completed' ? 'green' : run.status === 'failed' ? 'red' : 'cyan'
                  }
                >
                  {run.findings.length} findings
                </Pill>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-label="Run progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
              {run.errors.length ? (
                <div className="run-errors">
                  {run.errors.map((item, index) => (
                    <p key={`${item}-${index}`}>
                      <AlertCircle size={15} />
                      {item}
                    </p>
                  ))}
                </div>
              ) : null}
              {run.status === 'running' || run.status === 'queued' ? (
                <Button variant="danger" onClick={() => void cancel()}>
                  <CircleStop size={17} />
                  Cancel run
                </Button>
              ) : run.status === 'completed' ? (
                <Link className="button button-secondary" to="/results">
                  Review normalized findings
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="preview-empty">
              <ShieldCheck />
              <h2>Ready when you are</h2>
              <p>Mock mode exercises the full workflow without contacting external services.</p>
            </div>
          )}
        </Card>
      </div>
      {error ? (
        <div className="inline-alert error" role="alert">
          <AlertCircle />
          {error}
        </div>
      ) : null}
    </div>
  );
}

function mergeFindings(current: Finding[], incoming: Finding[]): Finding[] {
  return deduplicateFindings([
    ...current.map((item) => ({ ...item, provenance: [...item.provenance], tags: [...item.tags] })),
    ...incoming,
  ]).slice(0, 5_000);
}

const RUN_STORAGE_KEY = 'reconforge.connected-run.v1';

function readStoredRun(): ConnectedRun | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(RUN_STORAGE_KEY) ?? 'null') as unknown;
    if (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      typeof value.id === 'string' &&
      'status' in value &&
      typeof value.status === 'string'
    )
      return value as ConnectedRun;
  } catch {
    /* Ignore corrupt session-only progress state. */
  }
  return null;
}
