# Deployment

## GitHub Pages: planner mode

The `pages.yml` workflow builds with `--base=/ReconForge-Web/` and deploys `apps/web/dist`. Planner mode needs no secrets. Hash routing makes refreshes safe under the repository subpath.

Repository Pages settings must use **GitHub Actions** as the source. Do not define `BRAVE_SEARCH_API_KEY`, `URLSCAN_API_KEY`, `SHODAN_API_KEY`, or `APP_ACCESS_TOKEN` as frontend build variables.

GitHub Pages does not provide repository-controlled HTTP response headers. The planner therefore ships a restrictive meta CSP, but `frame-ancestors` is not effective from a meta policy. Deploy behind a header-capable static host or reverse proxy and set `Content-Security-Policy: frame-ancestors 'none'` when clickjacking resistance is required.

Local Pages build:

```bash
npm ci
npm run build:pages
```

## Owner API: Docker

The multi-stage `Dockerfile` runs as an unprivileged user. Compose additionally uses a read-only root filesystem, removes Linux capabilities, enables `no-new-privileges`, binds only to loopback by default, and supplies a 16 MB temporary filesystem.

```bash
cp .env.example .env
# Set CONNECTED_MODE=true, APP_ACCESS_TOKEN, an exact CORS origin, and optional provider keys.
docker compose up --build -d
curl http://127.0.0.1:8787/health
```

Put an HTTPS reverse proxy in front of any remote deployment. Configure only the exact public planner origin in `CORS_ALLOWLIST`; do not use a wildcard. Keep the API private to the owner where practical.

## Statelessness and scaling

The v0.2 service keeps a bounded maximum of 100 recent run records in memory and has no cloud database. This is appropriate for a single owner instance. Do not horizontally scale it without replacing the in-memory rate limiter and run store with an authenticated shared store, or quotas and cancellation state will be instance-local.

## Operational checks

- `/health` returns connected-mode and public provider availability only—no secrets.
- A request to `/v1/providers` without the bearer token returns 401 (or 503 when disabled).
- A request from an origin outside the allowlist is rejected.
- A `*.uz` connected run is rejected even with authentication.
- Logs do not include `Authorization`, `X-Subscription-Token`, findings, or snippets.
- Container filesystem is read-only and the process is non-root.

## Release process

1. Run every command listed in the root README quality suite.
2. Build the Docker image.
3. Inspect desktop/mobile screenshots and the final dependency audit.
4. Push `main`; verify both CI and Pages workflows.
5. Open the live planner and exercise the synthetic demo.
6. Tag and publish a semantic version only after CI and Pages are green.
