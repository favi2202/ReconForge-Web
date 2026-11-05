import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import {
  compileQueries,
  deduplicateFindings,
  isProviderResultAllowed,
  normalizeProviderResult,
  parseScope,
  type Finding,
  type ParsedScope,
} from '@reconforge/core';
import { templates } from '@reconforge/templates';
import Fastify, { LogController, type FastifyInstance, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ApiConfig } from './config.js';
import { registerLocalToolRoutes } from './local-tools.js';
import {
  BraveSearchProvider,
  MockProvider,
  ProviderError,
  ShodanSearchProvider,
  UrlscanSearchProvider,
  type PassiveProvider,
  type PassiveProviderId,
} from './providers.js';

const runRequestSchema = z.object({
  scope: z.string().min(3).max(253),
  exclusions: z.array(z.string().min(3).max(253)).max(25).default([]),
  templateIds: z.array(z.string().min(1).max(100)).min(1).max(20),
  provider: z.enum(['mock', 'brave', 'urlscan', 'shodan']),
  maximumResults: z.number().int().min(1).max(100).default(50),
  authorizationConfirmed: z.boolean().default(false),
  authorizationStatement: z.string().min(20).max(1000),
});

type RunRequest = z.infer<typeof runRequestSchema>;
type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

interface RunRecord {
  id: string;
  status: RunStatus;
  provider: PassiveProviderId;
  scope: ParsedScope;
  queryCount: number;
  completedQueries: number;
  findings: Finding[];
  errors: string[];
  createdAt: string;
  finishedAt: string | null;
  ownerKey: string;
  controller: AbortController;
}

interface BuildOptions {
  providers?: Partial<Record<PassiveProviderId, PassiveProvider>>;
}

export async function buildApp(
  config: ApiConfig,
  options: BuildOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 64 * 1024,
    requestTimeout: 15_000,
    connectionTimeout: 10_000,
    logger: {
      level: config.logLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.x-subscription-token',
          'req.headers.api-key',
          '*.apiKey',
          '*.braveApiKey',
          '*.urlscanApiKey',
          '*.shodanApiKey',
          '*.accessToken',
          '*.findings',
          '*.snippet',
        ],
        censor: '[REDACTED]',
      },
    },
    logController: new LogController({ disableRequestLogging: true }),
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  await app.register(cors, {
    credentials: false,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    origin(origin, callback) {
      if (!origin || config.corsAllowlist.includes(origin)) callback(null, true);
      else callback(new Error('Origin is not allowed.'), false);
    },
  });
  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => ({ error: 'Rate limit exceeded.', code: 'RATE_LIMITED' }),
  });

  const runs = new Map<string, RunRecord>();
  const principalLimiter = new FixedWindowLimiter(config.rateLimitMax, 60_000);
  const runStartLimiter = new FixedWindowLimiter(5, 60 * 60 * 1000);
  const providers: Record<PassiveProviderId, PassiveProvider> = {
    mock: options.providers?.mock ?? new MockProvider(),
    brave:
      options.providers?.brave ??
      new BraveSearchProvider(config.braveApiKey, config.providerTimeoutMs),
    urlscan:
      options.providers?.urlscan ??
      new UrlscanSearchProvider(config.urlscanApiKey, config.providerTimeoutMs),
    shodan:
      options.providers?.shodan ??
      new ShodanSearchProvider(config.shodanApiKey, config.providerTimeoutMs),
  };
  const providerDailyBudgets: Record<PassiveProviderId, FixedWindowLimiter> = {
    mock: new FixedWindowLimiter(config.providerDailyQueryLimits.mock, 24 * 60 * 60 * 1000),
    brave: new FixedWindowLimiter(config.providerDailyQueryLimits.brave, 24 * 60 * 60 * 1000),
    urlscan: new FixedWindowLimiter(config.providerDailyQueryLimits.urlscan, 24 * 60 * 60 * 1000),
    shodan: new FixedWindowLimiter(config.providerDailyQueryLimits.shodan, 24 * 60 * 60 * 1000),
  };

  app.get('/health', () => ({
    status: 'ok',
    connectedMode: config.connectedMode,
    providers: Object.values(providers).map(publicProviderState),
  }));

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/v1/')) return;
    if (!config.connectedMode) {
      await reply
        .code(503)
        .send({ error: 'Connected owner mode is disabled.', code: 'CONNECTED_MODE_DISABLED' });
      return;
    }
    const token = readBearerToken(request);
    if (!token || !config.accessToken || !safeEqual(token, config.accessToken)) {
      await reply
        .header('WWW-Authenticate', 'Bearer')
        .code(401)
        .send({ error: 'Authentication required.', code: 'UNAUTHORIZED' });
      return;
    }
    const ownerKey = tokenFingerprint(token);
    request.headers['x-reconforge-owner'] = ownerKey;
    if (!principalLimiter.take(ownerKey)) {
      await reply.code(429).send({ error: 'Owner quota exceeded.', code: 'OWNER_RATE_LIMITED' });
    }
  });

  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/v1/')) reply.header('Cache-Control', 'no-store');
    return payload;
  });

  app.get('/v1/providers', () => ({
    providers: Object.values(providers).map(publicProviderState),
  }));

  app.post('/v1/runs', async (request, reply) => {
    const parsed = runRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({
        error: 'Invalid run request.',
        code: 'INVALID_REQUEST',
        details: parsed.error.issues,
      });
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
        error:
          'Connected execution is disabled for public-suffix scopes. Use planner preview and browser deep links.',
        code: 'BROAD_SCOPE_EXECUTION_DISABLED',
      });
    }
    const selectedTemplates = parsed.data.templateIds.map((id) =>
      templates.find((template) => template.id === id),
    );
    if (selectedTemplates.some((template) => !template)) {
      return reply
        .code(400)
        .send({ error: 'One or more template IDs are unknown.', code: 'UNKNOWN_TEMPLATE' });
    }
    if (
      selectedTemplates.some((template) => template?.requiresExplicitAuthorization) &&
      !parsed.data.authorizationConfirmed
    ) {
      return reply.code(403).send({
        error: 'These templates require explicit authorization confirmation.',
        code: 'AUTHORIZATION_CONFIRMATION_REQUIRED',
      });
    }
    const provider = providers[parsed.data.provider];
    if (!provider.available)
      return reply
        .code(503)
        .send({ error: `${provider.name} is not configured.`, code: 'PROVIDER_UNAVAILABLE' });
    if (parsed.data.provider === 'mock' && scope.registrableDomain !== 'example.com') {
      return reply.code(400).send({
        error: 'The synthetic provider is restricted to the reserved example.com demo domain.',
        code: 'MOCK_SCOPE_RESTRICTED',
      });
    }
    const queryLimit = Math.min(config.runQueryLimit, scope.hardQueryLimit);
    const queries = compileQueries(
      scope,
      selectedTemplates.flatMap((item) => (item ? [item] : [])),
      {
        provider: parsed.data.provider,
        authorizationConfirmed: parsed.data.authorizationConfirmed,
        maximumQueries: queryLimit,
      },
    );
    if (!queries.length)
      return reply
        .code(400)
        .send({ error: 'No compatible queries were generated.', code: 'NO_COMPATIBLE_QUERIES' });
    trimRuns(runs);
    const active = [...runs.values()].filter((run) => ['queued', 'running'].includes(run.status));
    if (active.filter((run) => run.ownerKey === ownerKey(request)).length >= 2) {
      return reply.code(429).send({
        error: 'At most two runs may be active per owner.',
        code: 'RUN_CONCURRENCY_LIMIT',
      });
    }
    if (active.length >= 3) {
      return reply
        .code(503)
        .send({ error: 'The global run queue is full.', code: 'RUN_QUEUE_FULL' });
    }
    const owner = ownerKey(request);
    if (!runStartLimiter.take(owner)) {
      return reply
        .code(429)
        .send({ error: 'Owner run-start budget exceeded.', code: 'RUN_START_BUDGET' });
    }
    if (!providerDailyBudgets[provider.id].take('global', Date.now(), queries.length)) {
      return reply.code(429).send({
        error: 'The provider daily query budget is exhausted.',
        code: 'PROVIDER_DAILY_BUDGET',
      });
    }
    const record: RunRecord = {
      id: randomUUID(),
      status: 'queued',
      provider: parsed.data.provider,
      scope,
      queryCount: queries.length,
      completedQueries: 0,
      findings: [],
      errors: [],
      createdAt: new Date().toISOString(),
      finishedAt: null,
      ownerKey: ownerKey(request),
      controller: new AbortController(),
    };
    runs.set(record.id, record);
    void executeRun(record, parsed.data, queries, provider, config).catch((error: unknown) => {
      record.status = record.controller.signal.aborted ? 'cancelled' : 'failed';
      record.errors.push(safeError(error));
      record.finishedAt = new Date().toISOString();
    });
    return reply.code(202).send(runView(record));
  });

  app.get<{ Params: { id: string } }>('/v1/runs/:id', async (request, reply) => {
    const record = ownedRun(runs, request.params.id, ownerKey(request));
    if (!record) return reply.code(404).send({ error: 'Run not found.', code: 'NOT_FOUND' });
    return runView(record);
  });

  app.delete<{ Params: { id: string } }>('/v1/runs/:id', async (request, reply) => {
    const record = ownedRun(runs, request.params.id, ownerKey(request));
    if (!record) return reply.code(404).send({ error: 'Run not found.', code: 'NOT_FOUND' });
    if (record.status === 'queued' || record.status === 'running') {
      record.controller.abort(new Error('Run cancelled by owner.'));
      record.status = 'cancelled';
      record.finishedAt = new Date().toISOString();
    }
    return reply.code(202).send(runView(record));
  });

  registerLocalToolRoutes(app, config);

  app.setErrorHandler((error, _request, reply) => {
    const candidateStatus =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    const status =
      error instanceof ProviderError
        ? error.statusCode
        : candidateStatus < 500
          ? candidateStatus
          : 500;
    const message = error instanceof Error ? error.message : 'Request failed.';
    void reply.code(status).send({
      error: status >= 500 ? 'Request could not be completed.' : message,
      code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
    });
  });
  return app;
}

async function executeRun(
  record: RunRecord,
  request: RunRequest,
  queries: ReturnType<typeof compileQueries>,
  provider: PassiveProvider,
  config: ApiConfig,
): Promise<void> {
  record.status = 'running';
  const deadlineMs = Math.min(
    120_000,
    Math.max(15_000, config.providerTimeoutMs * Math.max(1, queries.length) * 2),
  );
  const deadlineReason = 'Run exceeded its overall execution deadline.';
  const deadline = setTimeout(() => {
    record.errors.push(deadlineReason);
    record.controller.abort(new Error(deadlineReason));
  }, deadlineMs);
  const all: Finding[] = [];
  const maximumResults = Math.min(request.maximumResults, config.runResultLimit);
  for (const query of queries) {
    if (record.controller.signal.aborted) break;
    const remaining = maximumResults - all.length;
    if (remaining <= 0) break;
    try {
      const results = await provider.search(query.query, {
        signal: record.controller.signal,
        maximumResults: Math.min(remaining, 20),
      });
      let rejectedForScope = false;
      for (const result of results) {
        try {
          if (!isProviderResultAllowed(result, query, record.scope)) {
            rejectedForScope = true;
            continue;
          }
          all.push(normalizeProviderResult(result, query, provider.id));
        } catch {
          record.errors.push('A provider result was rejected by URL validation.');
        }
      }
      if (rejectedForScope)
        record.errors.push('One or more provider results fell outside the query scope policy.');
    } catch (error) {
      if (record.controller.signal.aborted) break;
      record.errors.push(safeError(error));
    }
    record.completedQueries += 1;
    record.findings = deduplicateFindings(all).slice(0, maximumResults);
  }
  clearTimeout(deadline);
  record.status = record.controller.signal.aborted
    ? record.errors.includes(deadlineReason)
      ? 'failed'
      : 'cancelled'
    : record.errors.length && !record.findings.length
      ? 'failed'
      : 'completed';
  record.finishedAt = new Date().toISOString();
}

function readBearerToken(request: FastifyRequest): string | null {
  const value = request.headers.authorization;
  return value?.startsWith('Bearer ') ? value.slice(7) : null;
}

function safeEqual(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

function ownerKey(request: FastifyRequest): string {
  const value = request.headers['x-reconforge-owner'];
  return typeof value === 'string' ? value : 'anonymous';
}

function publicProviderState(provider: PassiveProvider) {
  return {
    id: provider.id,
    name: provider.name,
    available: provider.available,
    authentication: provider.authentication,
    supportedScopeTypes: provider.supportedScopeTypes,
    provenance: provider.provenance,
  };
}

function runView(record: RunRecord) {
  return {
    id: record.id,
    status: record.status,
    provider: record.provider,
    scope: record.scope,
    progress: { completedQueries: record.completedQueries, totalQueries: record.queryCount },
    findings: record.findings,
    errors: record.errors,
    createdAt: record.createdAt,
    finishedAt: record.finishedAt,
  };
}

function ownedRun(runs: Map<string, RunRecord>, id: string, owner: string): RunRecord | null {
  const record = runs.get(id);
  return record?.ownerKey === owner ? record : null;
}

function safeError(error: unknown): string {
  if (error instanceof ProviderError) return error.message.slice(0, 300);
  if (error instanceof Error && error.name === 'AbortError')
    return 'Provider request was cancelled.';
  return 'Provider request failed without exposing sensitive details.';
}

function trimRuns(runs: Map<string, RunRecord>): void {
  const expiry = Date.now() - 60 * 60 * 1000;
  for (const record of runs.values()) {
    if (
      !['queued', 'running'].includes(record.status) &&
      Date.parse(record.finishedAt ?? record.createdAt) < expiry
    )
      runs.delete(record.id);
  }
  if (runs.size < 100) return;
  const finished = [...runs.values()]
    .filter((run) => !['queued', 'running'].includes(run.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const record of finished.slice(0, Math.max(1, runs.size - 99))) runs.delete(record.id);
}

class FixedWindowLimiter {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();
  constructor(
    private readonly maximum: number,
    private readonly windowMs: number,
  ) {}
  take(key: string, now = Date.now(), units = 1): boolean {
    const current = this.windows.get(key);
    if (!current || now - current.startedAt >= this.windowMs) {
      this.windows.set(key, { startedAt: now, count: units });
      return units <= this.maximum;
    }
    current.count += units;
    return current.count <= this.maximum;
  }
}
