import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  KeyRound,
  LockKeyhole,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { Button, Card, PageHeader, Pill } from '../components/ui.js';
import { apiRequest, loadConnectedSettings, saveConnectedSettings } from '../lib/connected-api.js';

interface Health {
  status: string;
  connectedMode: boolean;
  providers: Array<{
    id: string;
    name: string;
    available: boolean;
    authentication: string;
    provenance: string;
  }>;
}

export function SettingsPage() {
  const stored = loadConnectedSettings();
  const [apiUrl, setApiUrl] = useState(stored.apiUrl);
  const [token, setToken] = useState(stored.token);
  const [message, setMessage] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const save = () => {
    try {
      const url = new URL(apiUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
        throw new Error();
      saveConnectedSettings({ apiUrl: url.toString(), token });
      window.dispatchEvent(new Event('reconforge-settings'));
      setMessage('Saved for this browser tab only.');
    } catch {
      setMessage('Enter a valid HTTP(S) API URL.');
    }
  };
  const test = async () => {
    setMessage('');
    setHealth(null);
    try {
      const response = await fetch(new URL('health', `${apiUrl.replace(/\/$/u, '')}/`));
      if (!response.ok) throw new Error(`Health check returned ${response.status}.`);
      const body = (await response.json()) as Health;
      setHealth(body);
      if (body.connectedMode) {
        await apiRequest({ apiUrl, token }, 'v1/providers');
        setMessage('API health and owner authentication succeeded.');
      } else {
        setMessage('API health succeeded; connected owner mode is disabled on the server.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'API health check failed.');
    }
  };
  return (
    <div className="page narrow-page">
      <PageHeader
        eyebrow="Provider settings"
        title="Public planner by default. Owner connection by choice."
        description="A static deployment never carries provider credentials. Connected mode points to a separately deployed, authenticated API."
      />
      <div className="mode-cards">
        <Card className="mode-card active">
          <div className="mode-icon">
            <ShieldCheck />
          </div>
          <div>
            <Pill tone="green">Always available</Pill>
            <h2>Public planner mode</h2>
            <p>
              Generate, explain, preview, open, import, annotate, and export—all locally without API
              keys.
            </p>
            <ul>
              <li>Browser IndexedDB persistence</li>
              <li>Browser deep links only</li>
              <li>No owner quota consumption</li>
            </ul>
          </div>
        </Card>
        <Card className="mode-card">
          <div className="mode-icon">
            <Cloud />
          </div>
          <div>
            <Pill tone="cyan">Optional</Pill>
            <h2>Connected owner mode</h2>
            <p>
              Bounded server-side collection through configured official providers and the offline
              mock.
            </p>
            <ul>
              <li>Bearer owner authentication</li>
              <li>Strict CORS and quotas</li>
              <li>Server-side provider credentials</li>
            </ul>
          </div>
        </Card>
      </div>
      <Card className="settings-form">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Session-only connection</span>
            <h2>
              <Server size={20} /> Owner API
            </h2>
          </div>
          <LockKeyhole />
        </div>
        <div className="settings-grid">
          <label>
            API base URL
            <input
              value={apiUrl}
              onChange={(event) => setApiUrl(event.target.value)}
              placeholder="http://127.0.0.1:8787"
            />
          </label>
          <label>
            Application access token
            <input
              type="password"
              value={token}
              autoComplete="off"
              onChange={(event) => setToken(event.target.value)}
              placeholder="At least 32 random characters"
            />
            <small>Stored in sessionStorage; cleared when this browser tab session ends.</small>
          </label>
        </div>
        <div className="settings-actions">
          <span
            role="status"
            className={
              message.toLowerCase().includes('succeed') || message.startsWith('Saved')
                ? 'success-text'
                : 'field-error'
            }
          >
            {message}
          </span>
          <Button variant="secondary" onClick={() => void test()}>
            Test health
          </Button>
          <Button onClick={save}>
            <KeyRound size={16} />
            Save session settings
          </Button>
        </div>
      </Card>
      {health ? (
        <Card>
          <div className="health-heading">
            <span className="status-dot" />
            <div>
              <h2>API is reachable</h2>
              <p>Connected mode is {health.connectedMode ? 'enabled' : 'disabled'}.</p>
            </div>
            <Pill tone={health.connectedMode ? 'green' : 'amber'}>{health.status}</Pill>
          </div>
          <div className="provider-list">
            {health.providers.map((provider) => (
              <div key={provider.id}>
                <span className={`provider-state ${provider.available ? 'available' : ''}`}>
                  {provider.available ? <CheckCircle2 /> : <AlertCircle />}
                </span>
                <div>
                  <b>{provider.name}</b>
                  <small>{provider.provenance}</small>
                </div>
                <Pill tone={provider.available ? 'green' : 'neutral'}>
                  {provider.available ? 'available' : 'not configured'}
                </Pill>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      <div className="banner info">
        <LockKeyhole />
        <div>
          <b>Credential boundary</b>
          <p>
            Provider API keys belong only in the API service environment. Never use a{' '}
            <code>VITE_</code>-prefixed variable for a secret.
          </p>
        </div>
      </div>
    </div>
  );
}
