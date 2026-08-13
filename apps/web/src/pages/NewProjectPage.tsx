import { AlertTriangle, ArrowRight, CheckCircle2, Info, ShieldCheck } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  compileQueriesForScopes,
  describeScopeBreadth,
  parseScopeList,
  ScopeError,
  type ReconProject,
} from '@reconforge/core';
import { packs, publicSuffixPackIds, templatesForPacks } from '@reconforge/templates';
import { Button, Card, PageHeader, Pill } from '../components/ui.js';
import { useProject } from '../state/project-store.js';

export function NewProjectPage() {
  const [name, setName] = useState('Authorized exposure review');
  const [scopeInput, setScopeInput] = useState('*.example.com');
  const [exclusionsInput, setExclusionsInput] = useState('');
  const [authorization, setAuthorization] = useState(
    'I confirm I own this scope or have explicit authorization to assess it.',
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const { updateProject } = useProject();
  const navigate = useNavigate();
  const parsed = useMemo(() => {
    try {
      return {
        scopes: parseScopeList(
          scopeInput,
          exclusionsInput
            .split(/[\n,]/u)
            .map((item) => item.trim())
            .filter(Boolean),
        ),
        error: null,
      };
    } catch (error) {
      return {
        scopes: null,
        error: error instanceof ScopeError ? error.message : 'The scope is invalid.',
      };
    }
  }, [scopeInput, exclusionsInput]);
  const previewScope = parsed.scopes?.[0];
  const scopeListCount = parsed.scopes?.length ?? 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!parsed.scopes || !acknowledged) return;
    const primaryScope = parsed.scopes[0];
    if (!primaryScope) return;
    const selectedPackIds =
      primaryScope.type === 'public-suffix'
        ? publicSuffixPackIds()
        : packs.filter((pack) => pack.enabledByDefault).map((pack) => pack.id);
    const queries = compileQueriesForScopes(parsed.scopes, templatesForPacks(selectedPackIds), {
      provider: 'google-link',
    });
    const now = new Date().toISOString();
    const project: ReconProject = {
      schemaVersion: '1.0',
      id: crypto.randomUUID(),
      name: name.trim(),
      authorizationStatement: authorization.trim(),
      scope: primaryScope,
      ...(parsed.scopes.length > 1 ? { additionalScopes: parsed.scopes.slice(1) } : {}),
      selectedPackIds,
      queries,
      findings: [],
      createdAt: now,
      updatedAt: now,
    };
    updateProject(project);
    void navigate('/planner');
  };

  return (
    <div className="page narrow-page">
      <PageHeader
        eyebrow="New reconnaissance project"
        title="Define a hard boundary."
        description="Scopes are parsed as hostnames—not URLs—and classified before any query can be generated."
      />
      <form onSubmit={submit} className="form-layout">
        <div className="form-main">
          <Card>
            <div className="step-title">
              <span>01</span>
              <div>
                <h2>Project details</h2>
                <p>Use a descriptive internal name and a hostname-only scope.</p>
              </div>
            </div>
            <label>
              Project name
              <input
                value={name}
                required
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Authorized scope
              <textarea
                rows={3}
                value={scopeInput}
                required
                maxLength={6800}
                aria-describedby={parsed.error ? 'scope-help scope-error' : 'scope-help'}
                aria-invalid={Boolean(parsed.error)}
                onChange={(event) => setScopeInput(event.target.value)}
              />
              <small id="scope-help">
                One scope, or up to 25 exact authorized domains separated by lines. Examples:
                example.com · *.example.com · *.uz
              </small>
            </label>
            {parsed.error ? (
              <div id="scope-error" className="inline-alert error" role="alert">
                <AlertTriangle size={17} />
                {parsed.error}
              </div>
            ) : null}
            <label>
              Excluded hostnames <span className="optional">optional</span>
              <textarea
                rows={3}
                value={exclusionsInput}
                onChange={(event) => setExclusionsInput(event.target.value)}
                placeholder={'legacy.example.com\nvendor.example.com'}
              />
              <small>One per line or comma-separated. Out-of-scope exclusions are ignored.</small>
            </label>
          </Card>
          <Card>
            <div className="step-title">
              <span>02</span>
              <div>
                <h2>Authorization</h2>
                <p>Record why this collection is permitted.</p>
              </div>
            </div>
            <label>
              Authorization statement
              <textarea
                rows={4}
                required
                minLength={20}
                maxLength={1000}
                value={authorization}
                onChange={(event) => setAuthorization(event.target.value)}
              />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              <span>
                <b>I understand the ethical-use boundary</b>
                <small>
                  ReconForge provides passive leads. I will not use it to test credentials, exploit
                  systems, or assess an unauthorized third party.
                </small>
              </span>
            </label>
          </Card>
        </div>
        <aside className="form-aside">
          <Card className="sticky-card">
            <span className="eyebrow">Scope preview</span>
            {previewScope ? (
              <>
                <div className="preview-status">
                  <CheckCircle2 />
                  <div>
                    <b>
                      {previewScope.normalized}
                      {scopeListCount > 1 ? ` +${scopeListCount - 1}` : ''}
                    </b>
                    <span>Valid {scopeListCount > 1 ? 'authorized-list' : previewScope.type}</span>
                  </div>
                </div>
                <dl className="scope-details">
                  <div>
                    <dt>Type</dt>
                    <dd>
                      <Pill tone={previewScope.type === 'public-suffix' ? 'amber' : 'cyan'}>
                        {scopeListCount > 1 ? 'authorized-list' : previewScope.type}
                      </Pill>
                    </dd>
                  </div>
                  <div>
                    <dt>Includes</dt>
                    <dd>
                      {scopeListCount > 1
                        ? `${scopeListCount} exact authorized domains`
                        : previewScope.includedHostnames}
                    </dd>
                  </div>
                  <div>
                    <dt>Public suffix</dt>
                    <dd>{scopeListCount > 1 ? 'Multiple' : `.${previewScope.publicSuffix}`}</dd>
                  </div>
                  <div>
                    <dt>Expected breadth</dt>
                    <dd>
                      {scopeListCount > 1 ? 'bounded list' : describeScopeBreadth(previewScope)}
                    </dd>
                  </div>
                  <div>
                    <dt>Hard query limit</dt>
                    <dd>{scopeListCount > 1 ? 100 : previewScope.hardQueryLimit}</dd>
                  </div>
                  <div>
                    <dt>Sensitive review</dt>
                    <dd>
                      {parsed.scopes?.every((scope) => scope.allowsSensitivePack)
                        ? 'Available after confirmation'
                        : 'Unavailable'}
                    </dd>
                  </div>
                </dl>
                {previewScope.warning ? (
                  <div className="inline-alert warning">
                    <AlertTriangle size={17} />
                    {previewScope.warning}
                  </div>
                ) : (
                  <div className="inline-alert info">
                    <Info size={17} />
                    Queries will be previewed before any external search is opened.
                  </div>
                )}
              </>
            ) : (
              <div className="preview-empty">
                <ShieldCheck />
                <p>Enter a valid scope to see its safety classification.</p>
              </div>
            )}
            <Button
              className="full"
              type="submit"
              disabled={
                !parsed.scopes ||
                !acknowledged ||
                name.trim().length < 1 ||
                authorization.trim().length < 20
              }
            >
              Create & plan <ArrowRight size={17} />
            </Button>
          </Card>
        </aside>
      </form>
    </div>
  );
}
