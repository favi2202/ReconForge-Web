import { z } from 'zod';

export const scopeTypeSchema = z.enum(['exact-domain', 'subdomain-tree', 'public-suffix']);
export type ScopeType = z.infer<typeof scopeTypeSchema>;

export const safetyLevelSchema = z.enum(['low', 'guarded', 'sensitive']);
export type SafetyLevel = z.infer<typeof safetyLevelSchema>;

export const reviewPrioritySchema = z.enum(['informational', 'low', 'medium', 'high']);
export type ReviewPriority = z.infer<typeof reviewPrioritySchema>;

export const providerIdSchema = z.enum([
  'google-link',
  'bing-link',
  'duckduckgo-link',
  'brave',
  'urlscan',
  'shodan',
  'mock',
]);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const resultPolicySchema = z.enum(['in-scope', 'fixed-hosts', 'external-reference']);
export type ResultPolicy = z.infer<typeof resultPolicySchema>;

export interface ParsedScope {
  original: string;
  normalized: string;
  value: string;
  type: ScopeType;
  registrableDomain: string | null;
  publicSuffix: string;
  includedHostnames: string;
  exclusions: string[];
  warning: string | null;
  hardQueryLimit: number;
  allowsSensitivePack: boolean;
}

export interface QueryTemplate {
  id: string;
  packId: string;
  name: string;
  description: string;
  category: string;
  supportedScopeTypes: ScopeType[];
  providers: ProviderId[];
  template: string;
  variables: string[];
  tags: string[];
  reviewPriority: ReviewPriority;
  explanation: string;
  safetyLevel: SafetyLevel;
  requiresExplicitAuthorization: boolean;
  resultPolicy: ResultPolicy;
  resultHostAllowlist: string[];
}

export interface QueryPack {
  id: string;
  name: string;
  description: string;
  safetyLevel: SafetyLevel;
  enabledByDefault: boolean;
  templateIds: string[];
}

export interface CompiledQuery {
  id: string;
  templateId: string;
  packId: string;
  provider: ProviderId;
  query: string;
  displayQuery: string;
  explanation: string;
  category: string;
  tags: string[];
  reviewPriority: ReviewPriority;
  safetyLevel: SafetyLevel;
  resultPolicy: ResultPolicy;
  resultHostAllowlist: string[];
}

export const compiledQuerySchema = z
  .object({
    id: z.string().min(1).max(120),
    templateId: z.string().min(1).max(120),
    packId: z.string().min(1).max(120),
    provider: providerIdSchema,
    query: z.string().min(1).max(2000),
    displayQuery: z.string().min(1).max(2000),
    explanation: z.string().min(1).max(2000),
    category: z.string().min(1).max(80),
    tags: z.array(z.string().max(40)).max(30),
    reviewPriority: reviewPrioritySchema,
    safetyLevel: safetyLevelSchema,
    resultPolicy: resultPolicySchema,
    resultHostAllowlist: z.array(z.string().min(1).max(253)).max(20),
  })
  .strict();

export const provenanceSchema = z
  .object({
    provider: z.string().min(1).max(40),
    queryId: z.string().min(1).max(120),
    query: z.string().min(1).max(2000),
    collectedAt: z.string().datetime(),
  })
  .strict();
export type Provenance = z.infer<typeof provenanceSchema>;

const httpUrlSchema = z
  .string()
  .url()
  .max(4096)
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  }, 'Only HTTP(S) URLs are accepted.');

export const findingSchema = z
  .object({
    id: z.string().min(1).max(160),
    url: httpUrlSchema,
    canonicalUrl: httpUrlSchema,
    title: z.string().max(500),
    snippet: z.string().max(4000),
    hostname: z.string().min(1).max(253),
    rootDomain: z.string().nullable(),
    source: z.string().min(1).max(40),
    category: z.string().min(1).max(80),
    reviewPriority: reviewPrioritySchema,
    firstSeenAt: z.string().datetime(),
    lastSeenAt: z.string().datetime(),
    provenance: z.array(provenanceSchema).min(1).max(100),
    tags: z.array(z.string().max(40)).max(30),
    notes: z.string().max(5000),
    status: z.enum(['unreviewed', 'reviewing', 'validated', 'false-positive']),
  })
  .strict();
export type Finding = z.infer<typeof findingSchema>;

const parsedScopeSchema = z
  .object({
    original: z.string(),
    normalized: z.string(),
    value: z.string(),
    type: scopeTypeSchema,
    registrableDomain: z.string().nullable(),
    publicSuffix: z.string(),
    includedHostnames: z.string(),
    exclusions: z.array(z.string()).max(100),
    warning: z.string().nullable(),
    hardQueryLimit: z.number().int().positive().max(100),
    allowsSensitivePack: z.boolean(),
  })
  .strict();

export const projectSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    id: z.string().min(1).max(120),
    name: z.string().min(1).max(120),
    authorizationStatement: z.string().min(10).max(1000),
    scope: parsedScopeSchema,
    additionalScopes: z.array(parsedScopeSchema).max(24).optional(),
    selectedPackIds: z.array(z.string().max(80)).max(30),
    queries: z.array(compiledQuerySchema).max(100),
    findings: z.array(findingSchema).max(5000),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type ReconProject = z.infer<typeof projectSchema>;
