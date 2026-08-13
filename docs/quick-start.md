# Quick start

## Planner-only local use

1. Install Node.js 24 LTS and npm 11 or later.
2. Run `npm ci`.
3. Run `npm run dev`.
4. Open `http://localhost:5173`.
5. Click **Load safe demo**. The demonstration uses deterministic `example.com` fixtures and makes no provider request.

To create a project, enter one hostname scope or up to 25 newline-separated exact authorized domains. Record the authorization statement, confirm the ethical-use boundary, and review the scope classification before creating queries.

## Safe first workflow

1. Create `*.example.com` with `legacy.example.com` excluded.
2. Keep the default low-risk packs selected.
3. Review query explanations in the planner.
4. Copy a query, or open one search deep link in a separate tab.
5. In **Results**, choose **Manual import** and paste `URL | title | plain-text snippet` rows.
6. Set status, notes, tags, and false positives.
7. Export Markdown and the scope manifest from **Reports**.

No external page is automatically retrieved at any step.

## Connected mock workflow

Create `.env` from `.env.example`:

```env
CONNECTED_MODE=true
# Generate a token first: node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
APP_ACCESS_TOKEN=
CORS_ALLOWLIST=http://localhost:5173
```

Run `npm run dev:api`. In the web app's **Providers** page, use `http://127.0.0.1:8787` and the same application token. Start a **Synthetic mock** run from **Live run**. Mock mode exercises authentication, quotas, progress, cancellation, normalization, and reporting without network collection.

## Troubleshooting

- `CONNECTED_MODE_DISABLED`: set `CONNECTED_MODE=true` and restart the API.
- `UNAUTHORIZED`: confirm the session token exactly matches `APP_ACCESS_TOKEN`.
- CORS error: add the exact planner origin to `CORS_ALLOWLIST`; wildcards are rejected.
- Brave unavailable: set `BRAVE_SEARCH_API_KEY` server-side, or use the mock provider.
- URLScan unavailable: set `URLSCAN_API_KEY` server-side; ReconForge uses search only and never submits URLs.
- Shodan unavailable: set `SHODAN_API_KEY` server-side; ReconForge uses host search only and never requests scans.
- GitHub Pages route issue: use the hash route (`/#/planner`); the application intentionally uses `HashRouter`.
