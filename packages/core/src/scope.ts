import { getDomain, getPublicSuffix, parse } from 'tldts';
import type { ParsedScope, ProviderId, ScopeType } from './types.js';

const HOST_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/u;
const FORBIDDEN_SCOPE_CHARS = /[\s/:?#@\\]/u;

export class ScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeError';
  }
}

function validateHostname(hostname: string, allowSingleLabel = false): void {
  if (hostname.length > 253 || (!allowSingleLabel && !hostname.includes('.'))) {
    throw new ScopeError('Enter a fully qualified domain or public suffix, such as example.com.');
  }
  const labels = hostname.split('.');
  if (labels.some((label) => !HOST_LABEL.test(label))) {
    throw new ScopeError('The scope contains an invalid hostname label.');
  }
}

export function parseScope(input: string, exclusions: string[] = []): ParsedScope {
  const original = input;
  const trimmed = input.trim().toLowerCase().replace(/\.$/u, '');
  if (!trimmed) throw new ScopeError('A scope is required.');
  if (FORBIDDEN_SCOPE_CHARS.test(trimmed) || trimmed.includes('[') || trimmed.includes(']')) {
    throw new ScopeError(
      'Enter a hostname only; URLs, paths, ports, credentials, and query strings are not accepted.',
    );
  }
  const wildcard = trimmed.startsWith('*.');
  if (trimmed.includes('*') && !wildcard) {
    throw new ScopeError('A wildcard is only permitted as the leftmost "*." prefix.');
  }
  const hostname = wildcard ? trimmed.slice(2) : trimmed;
  if (hostname.includes('*')) throw new ScopeError('Only one leftmost wildcard is permitted.');
  validateHostname(hostname, wildcard);
  if (isIpv4(hostname)) throw new ScopeError('IP address scopes are not supported.');

  const parsed = parse(hostname, { allowPrivateDomains: true });
  const publicSuffix = getPublicSuffix(hostname, { allowPrivateDomains: true });
  if (!publicSuffix || parsed.isIcann === false) {
    throw new ScopeError('The scope does not end in a recognized public suffix.');
  }
  const registrableDomain = getDomain(hostname, { allowPrivateDomains: true });
  let type: ScopeType;
  if (wildcard && hostname === publicSuffix) type = 'public-suffix';
  else if (wildcard) type = 'subdomain-tree';
  else type = 'exact-domain';

  if (type !== 'public-suffix' && !registrableDomain) {
    throw new ScopeError('The scope must include a registrable domain.');
  }

  const normalizedExclusions = [...new Set(exclusions.map(normalizeExclusion))].filter((item) => {
    if (type === 'exact-domain') return item === hostname;
    return item === hostname || item.endsWith(`.${hostname}`);
  });
  const broad = type === 'public-suffix';
  return {
    original,
    normalized: wildcard ? `*.${hostname}` : hostname,
    value: hostname,
    type,
    registrableDomain,
    publicSuffix,
    includedHostnames:
      type === 'exact-domain'
        ? `Only ${hostname}`
        : type === 'subdomain-tree'
          ? `${hostname} and its subdomains`
          : `Publicly indexed hostnames ending in .${hostname}`,
    exclusions: normalizedExclusions,
    warning: broad
      ? 'Public-suffix scopes are extremely broad. Only low-risk discovery templates are available, with reduced limits and mandatory preview.'
      : null,
    hardQueryLimit: broad ? 8 : 40,
    allowsSensitivePack: !broad && type === 'exact-domain',
  };
}

export function parseScopeList(input: string, exclusions: string[] = []): ParsedScope[] {
  const entries = input
    .split(/[\n,]/u)
    .map((item) => item.trim())
    .filter(Boolean);
  if (entries.length === 0) throw new ScopeError('A scope is required.');
  if (entries.length > 25) {
    throw new ScopeError('A manual scope list is limited to 25 authorized domains.');
  }
  if (entries.length === 1) return [parseScope(entries[0] ?? '', exclusions)];
  const scopes = entries.map((entry) => parseScope(entry, exclusions));
  if (scopes.some((scope) => scope.type !== 'exact-domain')) {
    throw new ScopeError(
      'Manual scope lists accept exact authorized domains only; configure wildcard or public-suffix scopes separately.',
    );
  }
  return [...new Map(scopes.map((scope) => [scope.normalized, scope])).values()];
}

function normalizeExclusion(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/^\*\./u, '').replace(/\.$/u, '');
  validateHostname(normalized);
  if (isIpv4(normalized)) throw new ScopeError('IP exclusions are not supported.');
  return normalized;
}

function isIpv4(value: string): boolean {
  const parts = value.split('.');
  return (
    parts.length === 4 && parts.every((part) => /^\d{1,3}$/u.test(part) && Number(part) <= 255)
  );
}

export function compileScopeSyntax(scope: ParsedScope, provider: ProviderId): string {
  if (provider === 'urlscan') {
    const base =
      scope.type === 'exact-domain'
        ? `page.domain.keyword:${scope.value}`
        : `page.domain:${scope.value}`;
    const exclusions = scope.exclusions.map((host) => `NOT page.domain:${host}`).join(' ');
    return [base, exclusions].filter(Boolean).join(' ');
  }
  if (provider === 'shodan') {
    const base = `hostname:${scope.value}`;
    const exclusions = scope.exclusions.map((host) => `-hostname:${host}`).join(' ');
    return [base, exclusions].filter(Boolean).join(' ');
  }
  // Search engines do not offer an authoritative exact-host filter. Keep the
  // query as narrow as each syntax permits, then enforce the same scope again
  // with isUrlInScope before any evidence is accepted.
  const base =
    scope.type === 'exact-domain'
      ? `site:${scope.value}`
      : scope.type === 'subdomain-tree'
        ? `(site:${scope.value} OR site:*.${scope.value})`
        : `site:*.${scope.value}`;
  const exclusions = scope.exclusions.map((host) => `-site:${host}`).join(' ');
  return [base, exclusions].filter(Boolean).join(' ');
}

export function isHostnameWithinBoundary(hostname: string, scope: ParsedScope): boolean {
  const candidate = hostname.trim().toLowerCase().replace(/\.$/u, '');
  if (!candidate || candidate.includes('*')) return false;
  return scope.type === 'exact-domain'
    ? candidate === scope.value
    : scope.type === 'subdomain-tree'
      ? candidate === scope.value || candidate.endsWith(`.${scope.value}`)
      : candidate.endsWith(`.${scope.value}`);
}

export function isHostnameInScope(hostname: string, scope: ParsedScope): boolean {
  const candidate = hostname.trim().toLowerCase().replace(/\.$/u, '');
  if (!isHostnameWithinBoundary(candidate, scope)) return false;
  return !scope.exclusions.some(
    (excluded) => candidate === excluded || candidate.endsWith(`.${excluded}`),
  );
}

export function isUrlInScope(url: string, scope: ParsedScope): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      isHostnameInScope(parsed.hostname, scope)
    );
  } catch {
    return false;
  }
}

export function describeScopeBreadth(scope: ParsedScope): 'narrow' | 'moderate' | 'broad' {
  if (scope.type === 'exact-domain') return 'narrow';
  if (scope.type === 'subdomain-tree') return 'moderate';
  return 'broad';
}
