import {
  AlertCircle,
  CheckCircle2,
  CircleStop,
  LoaderCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, EmptyState, PageHeader, Pill } from '../components/ui.js';
import { apiRequest, loadConnectedSettings } from '../lib/connected-api.js';
import { useProject } from '../state/project-store.js';

interface ToolState {
  id: 'subfinder' | 'dnsx' | 'httpx' | 'nuclei';
  name: string;
  installed: boolean;
  description: string;
  contact: 'passive' | 'active';
}

interface ToolHealth {
  enabled: boolean;
  tools: ToolState[];
}

interface LocalRun {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  scope: { normalized: string; type: string };
  profile: 'quick';
  stages: Array<{
    id: ToolState['id'];
    name: string;
    status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
    itemCount: number;
    message: string;
    startedAt: string | null;
    finishedAt: string | null;
  }>;
  assets: {
    hostnames: string[];
    urls: Array<{
      url: string;
      hostname: string;
      statusCode: number | null;
      title: string;
      technologies: string[];
      webServer: string | null;
    }>;
  };
  findings: Array<{
    templateId: string;
    name: string;
    severity: string;
    matchedAt: string;
    hostname: string;
  }>;
  errors: string[];
  createdAt: string;
  finishedAt: string | null;
}

export function LocalToolsPage() {
  const { project } = useProject();
  const settings = loadConnectedSettings();
  const configured = Boolean(settings.apiUrl && settings.token);
  const [health, setHealth] = useState<ToolHealth | null>(null);
  const [run, setRun] = useState<LocalRun | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const pollRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!configured) return;
    try {
      setHealth(await apiRequest<ToolHealth>(settings, 'v1/tools'));
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read local tool health.');
    }
  }, [configured, settings]);

  useEffect(() => {
    void refresh();
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [refresh]);

  if (!project) {
    return (
      <div className="page">
        <EmptyState
          icon={<Wrench />}
          title="Create an authorized project first"
          description="Local tools inherit the current project's validated hostname boundary and authorization statement."
          action={
            <Link className="button button-primary" to="/new">
              Create project
            </Link>
          }
        />
      </div>
    );
  }

  const blocked = project.scope.type === 'public-suffix' || Boolean(project.additionalScopes?.length);

  const poll = async (id: string) => {
    try {
      const next = await apiRequest<LocalRun>(settings, `v1/local-runs/${id}`);
      setRun(next);
      if (next.status === 'queued' || next.status === 'running') {
        pollRef.current = window.setTimeout(() => void poll(id), 2_000);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read local run status.');
    }
  };

  const start = async () => {
    setMessage('');
    try {
      const created = await apiRequest<LocalRun>(settings, 'v1/local-runs', {
        method: 'POST',
        body: JSON.stringify({
          scope: project.scope.normalized,
          exclusions: project.scope.exclusions,
          profile: 'quick',
          authorizationConfirmed: true,
          authorizationStatement: project.authorizationStatement,
        }),
      });
      setRun(created);
      void poll(created.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start local pipeline.');
    }
  };

  const cancel = async () => {
    if (!run) return;
    try {
      const next = await apiRequest<LocalRun>(settings, `v1/local-runs/${run.id}`, {
        method: 'DELETE',
      });
      setRun(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to cancel local pipeline.');
    }
  };

  return (
    <div className="page narrow-page">
      <PageHeader
        eyebrow="Active authorized mode"
        title="Run the local quick pipeline."
        description="ReconForge constructs fixed commands server-side. The browser cannot supply shell text, arbitrary flags, raw URLs, or public-suffix targets."
      />

      {!configured ? (
        <div className="banner info">
          <ShieldCheck />
          <div>
            <b>Owner API connection required</b>
            <p>Configure the local API URL and owner token before using installed security tools.</p>
          </div>
          <Link className="button button-secondary" to="/settings">
            Provider settings
          </Link>
        </div>
      ) : null}

      {blocked ? (
        <div className="banner warning">
          <AlertCircle />
          <div>
            <b>This project cannot run active local tools</b>
            <p>
              Use one exact-domain or one subdomain-tree project. Public suffixes and multi-domain
              lists remain planner-only.
            </p>
          </div>
        </div>
      ) : null}

      {health && !health.enabled ? (
        <div className="banner warning">
          <AlertCircle />
          <div>
            <b>Local execution is disabled on the API</b>
            <p>
              Set <code>LOCAL_TOOLS_ENABLED=true</code> in the API environment and restart it.
            </p>
          </div>
        </div>
      ) : null}

      <Card className="settings-form">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Tool health</span>
            <h2>WSL executables</h2>
          </div>
          <Button variant="secondary" onClick={() => void refresh()} disabled={!configured}>
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>
        <div className="provider-list">
          {(health?.tools ?? []).map((tool) => (
            <div key={tool.id}>
              <span className={`provider-state ${tool.installed ? 'available' : ''}`}>
                {tool.installed ? <CheckCircle2 /> : <AlertCircle />}
              </span>
              <div>
                <b>{tool.name}</b>
                <small>
                  {tool.description} · {tool.contact}
                </small>
              </div>
              <Pill tone={tool.installed ? 'green' : 'neutral'}>
                {tool.installed ? 'installed' : 'missing'}
              </Pill>
            </div>
          ))}
        </div>
      </Card>

      <div className="run-grid">
        <Card>
          <span className="eyebrow">Quick profile</span>
          <h2>{project.name}</h2>
          <dl className="scope-details">
            <div>
              <dt>Scope</dt>
              <dd>{project.scope.normalized}</dd>
            </div>
            <div>
              <dt>Pipeline</dt>
              <dd>Subfinder → DNSx → HTTPx → Nuclei</dd>
            </div>
            <div>
              <dt>HTTP rate</dt>
              <dd>5 requests/sec max</dd>
            </div>
            <div>
              <dt>Nuclei severities</dt>
              <dd>Low → Critical</dd>
            </div>
          </dl>

          <label className="check-row">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              <b>I confirm active testing of this exact scope is authorized</b>
              <small>
                DNS resolution, HTTP probing, and Nuclei contact the approved target. Scope is
                re-parsed and enforced again by the API.
              </small>
            </span>
          </label>

          <Button
            className="full"
            disabled={
              !configured ||
              !health?.enabled ||
              blocked ||
              !confirmed ||
              run?.status === 'queued' ||
              run?.status === 'running'
            }
            onClick={() => void start()}
          >
            <Play size={17} /> Start local quick pipeline
          </Button>
        </Card>

        <Card className="run-progress">
          <span className="eyebrow">Pipeline progress</span>
          {run ? (
            <>
              <div className={`run-state ${run.status}`}>
                <span>
                  {run.status === 'queued' || run.status === 'running' ? (
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
                    {run.assets.hostnames.length} hosts · {run.assets.urls.length} HTTP URLs ·{' '}
                    {run.findings.length} findings
                  </p>
                </div>
              </div>
              <div className="provider-list">
                {run.stages.map((stage) => (
                  <div key={stage.id}>
                    <span
                      className={`provider-state ${
                        stage.status === 'completed' ? 'available' : ''
                      }`}
                    >
                      {stage.status === 'running' ? (
                        <LoaderCircle className="spin" />
                      ) : stage.status === 'completed' ? (
                        <CheckCircle2 />
                      ) : (
                        <AlertCircle />
                      )}
                    </span>
                    <div>
                      <b>{stage.name}</b>
                      <small>{stage.message || stage.status}</small>
                    </div>
                    <Pill tone={stage.status === 'completed' ? 'green' : 'neutral'}>
                      {stage.itemCount || stage.status}
                    </Pill>
                  </div>
                ))}
              </div>
              {run.status === 'queued' || run.status === 'running' ? (
                <Button variant="danger" onClick={() => void cancel()}>
                  <CircleStop size={17} /> Cancel
                </Button>
              ) : null}
            </>
          ) : (
            <div className="preview-empty">
              <ShieldCheck />
              <h2>Ready for an authorized target</h2>
              <p>Start only after the project boundary and authorization are correct.</p>
            </div>
          )}
        </Card>
      </div>

      {run?.errors.length ? (
        <div className="banner warning">
          <AlertCircle />
          <div>
            <b>Pipeline notes</b>
            <p>{run.errors.join(' ')}</p>
          </div>
        </div>
      ) : null}

      {run?.findings.length ? (
        <section className="finding-groups">
          <div className="finding-group-heading">
            <h2>Nuclei findings</h2>
            <Pill tone="cyan">{run.findings.length}</Pill>
          </div>
          <div className="finding-card-grid">
            {run.findings.map((finding) => (
              <Card
                key={`${finding.templateId}|${finding.matchedAt}`}
                className="finding-card"
              >
                <div className="finding-card-head">
                  <Pill
                    tone={
                      finding.severity === 'critical' || finding.severity === 'high'
                        ? 'red'
                        : finding.severity === 'medium'
                          ? 'amber'
                          : 'cyan'
                    }
                  >
                    {finding.severity}
                  </Pill>
                  <code>{finding.templateId}</code>
                </div>
                <h2>{finding.name}</h2>
                <code>{finding.hostname}</code>
                <p>{finding.matchedAt}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {message ? (
        <div className="inline-alert error" role="alert">
          <AlertCircle /> {message}
        </div>
      ) : null}
    </div>
  );
}
