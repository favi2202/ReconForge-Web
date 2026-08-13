import type { CompiledQuery, ParsedScope, ProviderId, QueryTemplate } from './types.js';
import { compileScopeSyntax } from './scope.js';

export interface CompileOptions {
  provider: ProviderId;
  authorizationConfirmed?: boolean;
  variables?: Record<string, string>;
  maximumQueries?: number;
}

const SAFE_VARIABLE = /^[\p{L}\p{N} ._&'()-]{1,120}$/u;

export class QueryCompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryCompileError';
  }
}

export function compileQueries(
  scope: ParsedScope,
  templates: QueryTemplate[],
  options: CompileOptions,
): CompiledQuery[] {
  const maximum = Math.min(options.maximumQueries ?? scope.hardQueryLimit, scope.hardQueryLimit);
  const seen = new Set<string>();
  const compiled: CompiledQuery[] = [];

  for (const template of templates) {
    if (!template.supportedScopeTypes.includes(scope.type)) continue;
    if (!template.providers.includes(options.provider)) continue;
    if (template.requiresExplicitAuthorization && !options.authorizationConfirmed) continue;
    if (template.safetyLevel === 'sensitive' && !scope.allowsSensitivePack) continue;
    const query = renderTemplate(template, scope, options.variables ?? {}, options.provider);
    const key = normalizeQuery(query);
    if (seen.has(key)) continue;
    seen.add(key);
    compiled.push({
      id: stableId(`${template.id}:${options.provider}:${key}`),
      templateId: template.id,
      packId: template.packId,
      provider: options.provider,
      query,
      displayQuery:
        template.safetyLevel === 'sensitive' ? redactSensitiveQuery(query, scope) : query,
      explanation: template.explanation,
      category: template.category,
      tags: template.tags,
      reviewPriority: template.reviewPriority,
      safetyLevel: template.safetyLevel,
      resultPolicy: template.resultPolicy,
      resultHostAllowlist: template.resultHostAllowlist,
    });
    if (compiled.length >= maximum) break;
  }
  return compiled;
}

export function compileQueriesForScopes(
  scopes: ParsedScope[],
  templates: QueryTemplate[],
  options: CompileOptions & { globalMaximum?: number },
): CompiledQuery[] {
  const maximum = Math.min(options.globalMaximum ?? 100, 100);
  const byQuery = new Map<string, CompiledQuery>();
  for (const scope of scopes) {
    const remaining = maximum - byQuery.size;
    if (remaining <= 0) break;
    const compiled = compileQueries(scope, templates, {
      provider: options.provider,
      ...(options.authorizationConfirmed === undefined
        ? {}
        : { authorizationConfirmed: options.authorizationConfirmed }),
      ...(options.variables ? { variables: options.variables } : {}),
      maximumQueries: Math.min(scope.hardQueryLimit, remaining),
    });
    for (const query of compiled) byQuery.set(normalizeQuery(query.query), query);
  }
  return [...byQuery.values()].slice(0, maximum);
}

function stableId(value: string): string {
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489917);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

function renderTemplate(
  template: QueryTemplate,
  scope: ParsedScope,
  variables: Record<string, string>,
  provider: ProviderId,
): string {
  const builtins: Record<string, string> = {
    scope: compileScopeSyntax(scope, provider),
    // Never broaden a declared subdomain scope to its registrable parent.
    domain: scope.value,
    host: scope.value,
  };
  let rendered = template.template;
  for (const variable of template.variables) {
    const value = builtins[variable] ?? variables[variable];
    if (!value)
      throw new QueryCompileError(`Template ${template.id} requires the ${variable} variable.`);
    if (!(variable in builtins) && !SAFE_VARIABLE.test(value)) {
      throw new QueryCompileError(
        `Variable ${variable} contains unsupported operators or characters.`,
      );
    }
    rendered = rendered.replaceAll(`{{${variable}}}`, value.trim());
  }
  if (/\{\{[^}]+\}\}/u.test(rendered))
    throw new QueryCompileError(`Template ${template.id} has an unresolved variable.`);
  return normalizeWhitespace(rendered);
}

export function normalizeQuery(query: string): string {
  return normalizeWhitespace(query)
    .replace(/\s+(AND)\s+/giu, ' ')
    .toLowerCase();
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

function redactSensitiveQuery(query: string, scope: ParsedScope): string {
  return query
    .replace(scope.value, '[authorized-domain]')
    .replace(/("[^"\n]{1,120}")/gu, '"[redacted-indicator]"');
}

export interface VisualQueryInput {
  phrase?: string;
  inurl?: string;
  intitle?: string;
  fileTypes?: string[];
  excludeTerms?: string[];
}

const SAFE_PHRASE = /^[\p{L}\p{N} ._&'/-]{1,80}$/u;
const SAFE_OPERATOR_VALUE = /^[\p{L}\p{N}._~/-]{1,80}$/u;
const SAFE_FILETYPE = /^(?:pdf|docx?|xlsx?|pptx?|txt|csv|json|xml)$/u;

export function buildVisualQuery(
  scope: ParsedScope,
  provider: ProviderId,
  input: VisualQueryInput,
): string {
  const parts = [compileScopeSyntax(scope, provider)];
  if (input.phrase) parts.push(`"${safePhrase(input.phrase)}"`);
  if (input.inurl) parts.push(`inurl:${safeOperatorValue(input.inurl)}`);
  if (input.intitle) parts.push(`intitle:"${safePhrase(input.intitle)}"`);
  const fileTypes = [...new Set(input.fileTypes ?? [])].filter((item) => SAFE_FILETYPE.test(item));
  if (fileTypes.length === 1) parts.push(`filetype:${fileTypes[0]}`);
  else if (fileTypes.length > 1)
    parts.push(`(${fileTypes.map((item) => `filetype:${item}`).join(' OR ')})`);
  for (const term of (input.excludeTerms ?? []).slice(0, 10)) parts.push(`-"${safePhrase(term)}"`);
  return normalizeWhitespace(parts.join(' '));
}

function safePhrase(value: string): string {
  const trimmed = value.trim();
  if (
    !SAFE_PHRASE.test(trimmed) ||
    /(?:site|inurl|intitle|filetype):/iu.test(trimmed) ||
    /\b(?:AND|OR|NOT)\b/iu.test(trimmed)
  ) {
    throw new QueryCompileError('Custom values may not contain search operators.');
  }
  return trimmed.replace(/["()]/gu, '');
}

function safeOperatorValue(value: string): string {
  const trimmed = value.trim();
  if (!SAFE_OPERATOR_VALUE.test(trimmed) || /\b(?:AND|OR|NOT)\b/iu.test(trimmed)) {
    throw new QueryCompileError('Custom values may not contain search operators.');
  }
  return trimmed;
}

export function browserSearchUrl(provider: ProviderId, query: string): string {
  const encoded = encodeURIComponent(query);
  if (provider === 'google-link') return `https://www.google.com/search?q=${encoded}`;
  if (provider === 'bing-link') return `https://www.bing.com/search?q=${encoded}`;
  if (provider === 'duckduckgo-link') return `https://duckduckgo.com/?q=${encoded}`;
  if (provider === 'brave') return `https://search.brave.com/search?q=${encoded}`;
  throw new QueryCompileError('The mock provider does not have a browser search page.');
}
