import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { isHostnameInScope, isUrlInScope, parseScope, type ParsedScope } from '@reconforge/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ApiConfig } from './config.js';

export type LocalToolId = 'subfinder' | 'dnsx' | 'httpx' | 'nuclei';
type LocalRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
type StageStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';

interface ToolSpec {
  id: LocalToolId;
  name: string;
  binary: string;
  description: string;
  contact: 'passive' | 'active';
}

export interface LocalToolState {
  id: LocalToolId;
  name: string;
  installed: boolean;
  description: string;
  contact: 'passive' | 'active';
}

interface StageView {
  id: LocalToolId;
  name: string;
  status: StageStatus;
  itemCount: number;
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface HttpObservation {
  url: string;
  hostname: string;
  statusCode: number | null;
  title: string;
  technologies: string[];
  webServer: string | null;
}

interface NucleiFinding {
  templateId: string;
  name: string;
  severity: string;
  matchedAt: string;
  hostname: string;
}

interface LocalRunRecord {
  id: string;
  ownerKey: string;
  status: LocalRunStatus;
  scope: ParsedScope;
  profile: 'quick';
  stages: StageView[];
  hostnames: string[];
  urls: HttpObservation[];
  findings: NucleiFinding[];
  errors: string[];
  createdAt: string;
  finishedAt: string | null;
  controller: AbortController;
}

const toolSpecs: readonly ToolSpec[] = [
  {
    id: 'subfinder',
    name: 'Subfinder',
    binary: 'subfinder',
    description: 'Passive subdomain discovery for an authorized subdomain-tree scope.',
    contact: 'passive',
  },
  {
    id: 'dnsx',
    name: 'DNSx',
    binary: 'dnsx',
    description: 'Resolve only hostnames already inside the approved scope.',
    contact: 'active',
  },
  {
    id: 'httpx',
    name: 'HTTPx',
    binary: 'httpx',
    description: 'Probe approved resolved hosts for HTTP(S) metadata.',
    contact: 'active',
  },
  {
    id: 'nuclei',
    name: 'Nuclei',
    binary: 'nuclei',
    description: 'Run a bounded low-throughput vulnerability-template pass on approved URLs.',
    contact: 'active',
  },
];

const requestSchema = z.object({
  scope: z.string().min(3).max(253),
  exclusions: z.array(z.string().min(3).max(253)).max(25).default([]),
  profile: z.literal('quick').default('quick'),
  authorizationConfirmed: z.literal(true),
  authorizationStatement: z.string().min(20).max(1000),
});

export function registerLocalToolRoutes(app: FastifyInstance, config: ApiConfig): void {
  const runs = new Map<string, LocalRunRecord>();

  app.get('/v1/tools', async () => ({
    enabled: config.localToolsEnabled,
    tools: await detectLocalTools(),
  }));

  app.post('/v1/local-runs', async (request, reply) => {
    if (!config.localToolsEnabled) {
      return reply.code(503).send({
        error: 'Local tool execution is disabled on this API instance.',
        code: 'LOCAL_TOOLS_DISABLED',
      });
    }

    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid local run request.',
        code: 'INVALID_REQUEST',
        details: parsed.error.issues,
      });
    }

    let scope: ParsedScope;
    try {
      scope = parseScope(parsed.data.scope, parsed.data.exclusions);
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : 'Invalid scope.',
        code: 'INVALID_SCOPE',
      });
    }

    if (scope.type === 'public-suffix') {
      return reply.code(400).send({
        error: 'Active local execution is disabled for public-suffix scopes.',
        code: 'BROAD_SCOPE_EXECUTION_DISABLED',
      });
    }

    trimRuns(runs);
    const owner = ownerKey(request);
    const activeForOwner = [...runs.values()].filter(
      (run) => run.ownerKey === owner && ['queued', 'running'].includes(run.status),
    );
    if (activeForOwner.length >= 1) {
      return reply.code(429).send({
        error: 'Only one local active run may execute at a time per owner.',
        code: 'LOCAL_RUN_CONCURRENCY_LIMIT',
      });
    }

    const now = new Date().toISOString();
    const record: LocalRunRecord = {
      id: randomUUID(),
      ownerKey: owner,
      status: 'queued',
      scope,
      profile: parsed.data.profile,
      stages: toolSpecs.map((tool) => ({
        id: tool.id,
        name: tool.name,
        status: 'pending',
        itemCount: 0,
        message: '',
        startedAt: null,
        finishedAt: null,
      })),
      hostnames: [],
      urls: [],
      findings: [],
      errors: [],
      createdAt: now,
      finishedAt: null,
      controller: new AbortController(),
    };
    runs.set(record.id, record);

    void executePipeline(record, config).catch((error: unknown) => {
      if (record.controller.signal.aborted) record.status = 'cancelled';
      else {
        record.status = 'failed';
        record.errors.push(safeError(error));
      }
      record.finishedAt = new Date().toISOString();
    });

    return reply.code(202).send(runView(record));
  });

  app.get<{ Params: { id: string } }>('/v1/local-runs/:id', async (request, reply) => {
    const run = runs.get(request.params.id);
    if (!run || run.ownerKey !== ownerKey(request)) {
      return reply.code(404).send({ error: 'Local run not found.', code: 'NOT_FOUND' });
    }
    return runView(run);
  });

  app.delete<{ Params: { id: string } }>('/v1/local-runs/:id', async (request, reply) => {
    const run = runs.get(request.params.id);
    if (!run || run.ownerKey !== ownerKey(request)) {
      return reply.code(404).send({ error: 'Local run not found.', code: 'NOT_FOUND' });
    }
    if (run.status === 'queued' || run.status === 'running') {
      run.controller.abort(new Error('Local run cancelled by owner.'));
      run.status = 'cancelled';
      run.finishedAt = new Date().toISOString();
    }
    return reply.code(202).send(runView(run));
  });
}

export async function detectLocalTools(): Promise<LocalToolState[]> {
  return Promise.all(
    toolSpecs.map(async (tool) => ({
      id: tool.id,
      name: tool.name,
      installed: Boolean(await resolveExecutable(tool.binary)),
      description: tool.description,
      contact: tool.contact,
    })),
  );
}

async function executePipeline(record: LocalRunRecord, config: ApiConfig): Promise<void> {
  record.status = 'running';
  const states = await detectLocalTools();
  const installed = new Map(states.map((tool) => [tool.id, tool.installed]));
  let hostnames = [record.scope.value];

  if (record.scope.type === 'subdomain-tree') {
    if (installed.get('subfinder')) {
      try {
        const output = await runStage(record, 'subfinder', config, [
          '-silent',
          '-d',
          record.scope.value,
        ]);
        hostnames = unique([
          record.scope.value,
          ...parseHostnameLines(output).filter((host) => isHostnameInScope(host, record.scope)),
        ]);
        completeStage(record, 'subfinder', hostnames.length, 'Passive discovery completed.');
      } catch {
        failStage(record, 'subfinder', 'Subfinder failed.');
        record.errors.push('Subfinder failed; continuing with the authorized root hostname.');
      }
    } else {
      skipStage(record, 'subfinder', 'Subfinder is not installed.');
    }
  } else {
    skipStage(record, 'subfinder', 'Exact-host scope: subdomain expansion is disabled.');
  }

  hostnames = hostnames.filter((host) => isHostnameInScope(host, record.scope)).slice(0, 500);

  if (installed.get('dnsx')) {
    try {
      const output = await runStage(record, 'dnsx', config, ['-silent'], hostnames.join('\n'));
      const resolved = parseHostnameLines(output).filter((host) =>
        isHostnameInScope(host, record.scope),
      );
      if (resolved.length) hostnames = unique(resolved).slice(0, 500);
      completeStage(record, 'dnsx', hostnames.length, 'Approved hostnames resolved.');
    } catch {
      failStage(record, 'dnsx', 'DNSx failed.');
      record.errors.push('DNSx failed; continuing with the bounded hostname set.');
    }
  } else {
    skipStage(record, 'dnsx', 'DNSx is not installed.');
  }
  record.hostnames = hostnames;

  let observations: HttpObservation[] = [];
  if (installed.get('httpx') && hostnames.length) {
    try {
      const output = await runStage(
        record,
        'httpx',
        config,
        ['-silent', '-json', '-no-color', '-rate-limit', '5', '-timeout', '5', '-retries', '1'],
        hostnames.join('\n'),
      );
      observations = parseHttpx(output, record.scope).slice(0, 500);
      record.urls = observations;
      completeStage(record, 'httpx', observations.length, 'HTTP metadata collection completed.');
    } catch {
      failStage(record, 'httpx', 'HTTPx failed.');
      record.errors.push('HTTPx failed; the pipeline stopped before Nuclei.');
    }
  } else {
    skipStage(
      record,
      'httpx',
      installed.get('httpx') ? 'No approved hostnames were available.' : 'HTTPx is not installed.',
    );
  }

  if (installed.get('nuclei') && observations.length) {
    try {
      const output = await runStage(
        record,
        'nuclei',
        config,
        [
          '-silent',
          '-jsonl',
          '-severity',
          'low,medium,high,critical',
          '-rate-limit',
          '5',
          '-timeout',
          '5',
          '-retries',
          '0',
          '-no-color',
        ],
        observations.map((item) => item.url).join('\n'),
      );
      record.findings = parseNuclei(output, record.scope).slice(0, 250);
      completeStage(record, 'nuclei', record.findings.length, 'Bounded Nuclei pass completed.');
    } catch {
      failStage(record, 'nuclei', 'Nuclei failed or timed out.');
      record.errors.push('Nuclei failed or timed out.');
    }
  } else {
    skipStage(
      record,
      'nuclei',
      installed.get('nuclei')
        ? 'No approved HTTP URLs were available.'
        : 'Nuclei is not installed.',
    );
  }

  if (record.controller.signal.aborted) record.status = 'cancelled';
  else if (record.urls.length || record.hostnames.length) record.status = 'completed';
  else record.status = 'failed';
  record.finishedAt = new Date().toISOString();
}

async function runStage(
  record: LocalRunRecord,
  id: LocalToolId,
  config: ApiConfig,
  args: string[],
  input = '',
): Promise<string> {
  const spec = toolSpecs.find((tool) => tool.id === id);
  if (!spec) throw new Error('Unknown local tool.');
  const executable = await resolveExecutable(spec.binary);
  if (!executable) throw new Error('Local tool is not installed.');

  const stage = stageFor(record, id);
  stage.status = 'running';
  stage.startedAt = new Date().toISOString();
  stage.message = 'Running with fixed bounded arguments.';

  return runProcess(executable, args, input, {
    signal: record.controller.signal,
    timeoutMs: config.localToolTimeoutMs,
    maximumBytes: 2 * 1024 * 1024,
  });
}

function runProcess(
  executable: string,
  args: string[],
  input: string,
  options: { signal: AbortSignal; timeoutMs: number; maximumBytes: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (options.signal.aborted) {
      reject(new Error('Local run was cancelled.'));
      return;
    }

    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    const stdout: Buffer[] = [];
    let totalBytes = 0;
    let exceeded = false;
    let timedOut = false;

    const stop = () => {
      child.kill('SIGTERM');
      const force = setTimeout(() => child.kill('SIGKILL'), 1_000);
      force.unref();
    };
    const onAbort = () => stop();
    options.signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, options.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      totalBytes += chunk.byteLength;
      if (totalBytes > options.maximumBytes) {
        exceeded = true;
        stop();
      } else stdout.push(chunk);
    });
    child.stderr.on('data', () => undefined);

    child.on('error', (error) => {
      clearTimeout(timer);
      options.signal.removeEventListener('abort', onAbort);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      options.signal.removeEventListener('abort', onAbort);
      if (options.signal.aborted) return reject(new Error('Local run was cancelled.'));
      if (timedOut) return reject(new Error('Local tool exceeded its execution timeout.'));
      if (exceeded) return reject(new Error('Local tool exceeded its output limit.'));
      if (code !== 0) return reject(new Error('Local tool exited unsuccessfully.'));
      resolve(Buffer.concat(stdout).toString('utf8'));
    });

    child.stdin.end(input ? `${input}\n` : undefined);
  });
}

async function resolveExecutable(binary: string): Promise<string | null> {
  for (const directory of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    const candidate = join(directory, binary);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue searching PATH.
    }
  }
  return null;
}

function parseHostnameLines(output: string): string[] {
  return unique(
    output
      .split(/\r?\n/u)
      .map((line) => line.trim().split(/\s+/u)[0] ?? '')
      .map(normalizeHostname)
      .filter((value): value is string => Boolean(value)),
  );
}

function normalizeHostname(value: string): string | null {
  const candidate = value.trim().toLowerCase().replace(/\.$/u, '');
  if (!candidate || candidate.length > 253 || candidate.includes('/') || candidate.includes('*')) {
    return null;
  }
  return candidate.includes('.') ? candidate : null;
}

function parseHttpx(output: string, scope: ParsedScope): HttpObservation[] {
  const observations: HttpObservation[] = [];
  for (const line of output.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as Record<string, unknown>;
      const url = stringValue(value.url);
      if (!url || !isUrlInScope(url, scope)) continue;
      const parsed = new URL(url);
      const technologies = Array.isArray(value.tech)
        ? value.tech.filter((item): item is string => typeof item === 'string').slice(0, 30)
        : [];
      observations.push({
        url,
        hostname: parsed.hostname.toLowerCase(),
        statusCode: numberValue(value.status_code),
        title: stringValue(value.title) ?? '',
        technologies,
        webServer: stringValue(value.webserver),
      });
    } catch {
      // Ignore malformed tool lines.
    }
  }
  return uniqueBy(observations, (item) => item.url);
}

function parseNuclei(output: string, scope: ParsedScope): NucleiFinding[] {
  const findings: NucleiFinding[] = [];
  for (const line of output.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as Record<string, unknown>;
      const info =
        typeof value.info === 'object' && value.info !== null
          ? (value.info as Record<string, unknown>)
          : {};
      const matchedAt = stringValue(value['matched-at']) ?? stringValue(value.host);
      if (!matchedAt) continue;
      let hostname = '';
      try {
        const url = new URL(matchedAt);
        if (!isUrlInScope(url.toString(), scope)) continue;
        hostname = url.hostname.toLowerCase();
      } catch {
        const candidate = normalizeHostname(matchedAt);
        if (!candidate || !isHostnameInScope(candidate, scope)) continue;
        hostname = candidate;
      }
      findings.push({
        templateId: stringValue(value['template-id']) ?? 'unknown-template',
        name: stringValue(info.name) ?? 'Nuclei finding',
        severity: stringValue(info.severity) ?? 'unknown',
        matchedAt,
        hostname,
      });
    } catch {
      // Ignore malformed tool lines.
    }
  }
  return uniqueBy(findings, (item) => `${item.templateId}|${item.matchedAt}`);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 4096 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function completeStage(
  record: LocalRunRecord,
  id: LocalToolId,
  count: number,
  message: string,
): void {
  const stage = stageFor(record, id);
  stage.status = 'completed';
  stage.itemCount = count;
  stage.message = message;
  stage.finishedAt = new Date().toISOString();
}

function skipStage(record: LocalRunRecord, id: LocalToolId, message: string): void {
  const stage = stageFor(record, id);
  stage.status = 'skipped';
  stage.message = message;
  stage.finishedAt = new Date().toISOString();
}

function failStage(record: LocalRunRecord, id: LocalToolId, message: string): void {
  const stage = stageFor(record, id);
  stage.status = 'failed';
  stage.message = message;
  stage.finishedAt = new Date().toISOString();
}

function stageFor(record: LocalRunRecord, id: LocalToolId): StageView {
  const stage = record.stages.find((item) => item.id === id);
  if (!stage) throw new Error('Pipeline stage is missing.');
  return stage;
}

function runView(record: LocalRunRecord) {
  return {
    id: record.id,
    status: record.status,
    scope: { normalized: record.scope.normalized, type: record.scope.type },
    profile: record.profile,
    stages: record.stages,
    assets: { hostnames: record.hostnames, urls: record.urls },
    findings: record.findings,
    errors: record.errors,
    createdAt: record.createdAt,
    finishedAt: record.finishedAt,
  };
}

function ownerKey(request: FastifyRequest): string {
  const authorization = request.headers.authorization ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : authorization;
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

function safeError(error: unknown): string {
  if (error instanceof Error) {
    if (/cancel/iu.test(error.message)) return 'Local run was cancelled.';
    if (/timeout/iu.test(error.message)) return 'Local tool exceeded its execution timeout.';
    if (/output limit/iu.test(error.message)) return 'Local tool exceeded its output limit.';
  }
  return 'Local tool execution failed.';
}

function trimRuns(runs: Map<string, LocalRunRecord>): void {
  const expiry = Date.now() - 60 * 60 * 1000;
  for (const run of runs.values()) {
    if (
      !['queued', 'running'].includes(run.status) &&
      Date.parse(run.finishedAt ?? run.createdAt) < expiry
    ) {
      runs.delete(run.id);
    }
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [key(value), value])).values()];
}
