import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const optionalSecret = (minimum: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z
      .string()
      .min(minimum)
      .max(512)
      .refine(
        (value) =>
          !/(?:replace|change[-_ ]?me|example|placeholder|generate[-_ ]?a[-_ ]?random)/iu.test(
            value,
          ) && new Set(value).size >= 8,
        'Secret must not be a placeholder or low-diversity value.',
      )
      .optional(),
  );

const configSchema = z
  .object({
    CONNECTED_MODE: booleanString,
    APP_ACCESS_TOKEN: optionalSecret(32),
    BRAVE_SEARCH_API_KEY: optionalSecret(16),
    CORS_ALLOWLIST: z.string().default('http://localhost:5173'),
    API_HOST: z.string().default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(30),
    RUN_QUERY_LIMIT: z.coerce.number().int().min(1).max(40).default(20),
    RUN_RESULT_LIMIT: z.coerce.number().int().min(1).max(500).default(100),
    PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((value, context) => {
    if (value.CONNECTED_MODE && !value.APP_ACCESS_TOKEN) {
      context.addIssue({
        code: 'custom',
        path: ['APP_ACCESS_TOKEN'],
        message: 'Required when connected mode is enabled.',
      });
    }
    if (value.CORS_ALLOWLIST.split(',').some((origin) => origin.trim().includes('*'))) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ALLOWLIST'],
        message: 'Wildcard origins are not permitted.',
      });
    }
    for (const candidate of value.CORS_ALLOWLIST.split(',').map((item) => item.trim())) {
      try {
        const parsed = new URL(candidate);
        if (
          !candidate ||
          candidate === 'null' ||
          !['http:', 'https:'].includes(parsed.protocol) ||
          parsed.origin !== candidate ||
          parsed.username ||
          parsed.password
        )
          throw new Error('not an origin');
      } catch {
        context.addIssue({
          code: 'custom',
          path: ['CORS_ALLOWLIST'],
          message: 'Each CORS entry must be an exact HTTP(S) origin without a path.',
        });
        break;
      }
    }
  });

export interface ApiConfig {
  connectedMode: boolean;
  accessToken?: string;
  braveApiKey?: string;
  corsAllowlist: string[];
  host: string;
  port: number;
  rateLimitMax: number;
  runQueryLimit: number;
  runResultLimit: number;
  providerTimeoutMs: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const value = configSchema.parse(environment);
  return {
    connectedMode: value.CONNECTED_MODE,
    ...(value.APP_ACCESS_TOKEN ? { accessToken: value.APP_ACCESS_TOKEN } : {}),
    ...(value.BRAVE_SEARCH_API_KEY ? { braveApiKey: value.BRAVE_SEARCH_API_KEY } : {}),
    corsAllowlist: value.CORS_ALLOWLIST.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    host: value.API_HOST,
    port: value.API_PORT,
    rateLimitMax: value.RATE_LIMIT_MAX,
    runQueryLimit: value.RUN_QUERY_LIMIT,
    runResultLimit: value.RUN_RESULT_LIMIT,
    providerTimeoutMs: value.PROVIDER_TIMEOUT_MS,
    logLevel: value.LOG_LEVEL,
  };
}
