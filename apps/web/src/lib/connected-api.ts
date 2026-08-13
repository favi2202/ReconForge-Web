export interface ConnectedSettings {
  apiUrl: string;
  token: string;
}

export interface ConnectedRun {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: { completedQueries: number; totalQueries: number };
  findings: unknown[];
  errors: string[];
  scope?: { normalized: string };
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs: number | null,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

const SETTINGS_KEY = 'reconforge.connected-session.v1';

export function loadConnectedSettings(): ConnectedSettings {
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(SETTINGS_KEY) ?? '{}',
    ) as Partial<ConnectedSettings>;
    return { apiUrl: parsed.apiUrl ?? 'http://127.0.0.1:8787', token: parsed.token ?? '' };
  } catch {
    return { apiUrl: 'http://127.0.0.1:8787', token: '' };
  }
}

export function saveConnectedSettings(settings: ConnectedSettings): void {
  sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function apiRequest<T>(
  settings: ConnectedSettings,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const base = new URL(settings.apiUrl);
  if (!['http:', 'https:'].includes(base.protocol))
    throw new Error('API URL must use HTTP or HTTPS.');
  if (base.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
    throw new Error('Remote owner APIs must use HTTPS.');
  }
  const response = await fetch(new URL(path, `${base.toString().replace(/\/$/u, '')}/`), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.token}`,
      ...init.headers,
    },
  });
  const body = (await response.json()) as { error?: string } & T;
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    const retryAfterMs = retryAfter && /^\d+$/u.test(retryAfter) ? Number(retryAfter) * 1000 : null;
    throw new ApiRequestError(
      body.error ?? `API request failed (${response.status}).`,
      response.status,
      retryAfterMs,
    );
  }
  return body;
}
