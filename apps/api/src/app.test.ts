import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import type { ApiConfig } from './config.js';

const token = 'test-owner-token-that-is-longer-than-32-chars';
const baseConfig: ApiConfig = {
  connectedMode: true,
  accessToken: token,
  corsAllowlist: ['https://planner.example.test'],
  host: '127.0.0.1',
  port: 8787,
  rateLimitMax: 30,
  runQueryLimit: 10,
  runResultLimit: 30,
  providerTimeoutMs: 500,
  logLevel: 'silent',
};
const apps: FastifyInstance[] = [];

async function app(config: ApiConfig = baseConfig) {
  const instance = await buildApp(config);
  apps.push(instance);
  return instance;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (instance) => instance.close()));
});

describe('connected API security contract', () => {
  it('exposes a credential-free health state', async () => {
    const response = await (await app()).inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(token);
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('is disabled by default and requires bearer owner authentication', async () => {
    const disabled = await app({ ...baseConfig, connectedMode: false });
    expect((await disabled.inject({ method: 'GET', url: '/v1/providers' })).statusCode).toBe(503);
    const enabled = await app();
    expect((await enabled.inject({ method: 'GET', url: '/v1/providers' })).statusCode).toBe(401);
    expect(
      (
        await enabled.inject({
          method: 'GET',
          url: '/v1/providers',
          headers: { authorization: `Bearer ${token}` },
        })
      ).statusCode,
    ).toBe(200);
  });

  it('enforces the exact CORS allowlist', async () => {
    const instance = await app();
    const allowed = await instance.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin: 'https://planner.example.test', 'access-control-request-method': 'GET' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('https://planner.example.test');
    const blocked = await instance.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(blocked.statusCode).toBeGreaterThanOrEqual(400);
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects public-suffix execution, unknown templates, and missing authorization', async () => {
    const instance = await app();
    const send = (body: object) =>
      instance.inject({
        method: 'POST',
        url: '/v1/runs',
        headers: { authorization: `Bearer ${token}` },
        payload: body,
      });
    const common = {
      exclusions: [],
      provider: 'mock',
      maximumResults: 10,
      authorizationStatement: 'Authorized synthetic test scope only.',
      authorizationConfirmed: true,
    };
    expect(
      (await send({ ...common, scope: '*.uz', templateIds: ['domain-indexed-hosts'] })).json().code,
    ).toBe('BROAD_SCOPE_EXECUTION_DISABLED');
    expect(
      (await send({ ...common, scope: 'example.com', templateIds: ['not-real'] })).json().code,
    ).toBe('UNKNOWN_TEMPLATE');
    expect(
      (
        await send({ ...common, scope: 'example.org', templateIds: ['domain-indexed-hosts'] })
      ).json().code,
    ).toBe('MOCK_SCOPE_RESTRICTED');
    expect(
      (
        await send({
          ...common,
          scope: 'example.com',
          templateIds: ['admin-login-pages'],
          authorizationConfirmed: false,
        })
      ).json().code,
    ).toBe('AUTHORIZATION_CONFIRMATION_REQUIRED');
  });

  it('runs the offline mock end to end and returns bounded normalized findings', async () => {
    const instance = await app();
    const created = await instance.inject({
      method: 'POST',
      url: '/v1/runs',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        scope: 'example.com',
        exclusions: [],
        templateIds: ['domain-indexed-hosts', 'docs-common-types'],
        provider: 'mock',
        maximumResults: 4,
        authorizationConfirmed: true,
        authorizationStatement: 'Authorized synthetic example.com workflow.',
      },
    });
    expect(created.statusCode).toBe(202);
    const id = created.json().id as string;
    await new Promise((resolve) => setTimeout(resolve, 150));
    const result = await instance.inject({
      method: 'GET',
      url: `/v1/runs/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const body = result.json();
    expect(body.status).toBe('completed');
    expect(body.findings.length).toBeGreaterThan(0);
    expect(body.findings.length).toBeLessThanOrEqual(4);
    expect(
      body.findings.every((item: { hostname: string }) => item.hostname === 'example.com'),
    ).toBe(true);
    expect(
      body.findings.every((item: { canonicalUrl: string }) =>
        item.canonicalUrl.startsWith('https://'),
      ),
    ).toBe(true);
    expect(result.body).not.toContain(token);
    expect(result.headers['cache-control']).toBe('no-store');
  });

  it('enforces body size and both request quotas', async () => {
    const instance = await app({ ...baseConfig, rateLimitMax: 2 });
    const headers = { authorization: `Bearer ${token}` };
    expect(
      (await instance.inject({ method: 'GET', url: '/v1/providers', headers })).statusCode,
    ).toBe(200);
    expect(
      (await instance.inject({ method: 'GET', url: '/v1/providers', headers })).statusCode,
    ).toBe(200);
    expect(
      (await instance.inject({ method: 'GET', url: '/v1/providers', headers })).statusCode,
    ).toBe(429);
    const sizeApp = await app();
    const oversized = await sizeApp.inject({
      method: 'POST',
      url: '/v1/runs',
      headers: { ...headers, 'content-type': 'application/json' },
      payload: JSON.stringify({ padding: 'x'.repeat(70_000) }),
    });
    expect(oversized.statusCode).toBe(413);
  });
});
