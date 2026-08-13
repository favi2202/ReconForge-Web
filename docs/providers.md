# Provider configuration

## Browser deep links

Google, Bing, DuckDuckGo, and Brave can be selected in planner mode. ReconForge encodes the compiled query into the provider's public search URL and opens it with `noopener noreferrer`. The project does not scrape results or proxy anonymous traffic.

Google Custom Search JSON API is closed to new customers and scheduled to discontinue on January 1, 2027. Bing Search APIs retired on August 11, 2025. DuckDuckGo does not advertise a general web-results API. Their v0.1 treatment as browser-only providers is intentional; source links and review dates are in [research.md](research.md).

## Offline mock

The mock provider is always available when connected mode is enabled. It returns deterministic synthetic URLs on `example.com`. Use it for development, CI, demonstrations, and deployment smoke tests.

## Brave Search API

Brave is the only live connected search provider in v0.1.

1. Obtain an API subscription directly from Brave.
2. Set `BRAVE_SEARCH_API_KEY` only in the API environment.
3. Set `CONNECTED_MODE=true`, a strong `APP_ACCESS_TOKEN`, and an exact `CORS_ALLOWLIST`.
4. Restart the API and check `/health`; `brave.available` should be `true`.

The adapter calls only `https://api.search.brave.com/res/v1/web/search`, requests at most 20 results per query, uses moderate safe search, caps retries at three with exponential backoff, and enforces the configured timeout. The key is sent in `X-Subscription-Token`, is redacted from logs, and never enters API responses.

## API environment variables

| Variable               | Required     | Default                 | Purpose                                     |
| ---------------------- | ------------ | ----------------------- | ------------------------------------------- |
| `CONNECTED_MODE`       | No           | `false`                 | Enables `/v1/*`; must be explicitly `true`  |
| `APP_ACCESS_TOKEN`     | When enabled | —                       | Owner bearer token, minimum 32 characters   |
| `CORS_ALLOWLIST`       | No           | `http://localhost:5173` | Comma-separated exact origins; no wildcards |
| `BRAVE_SEARCH_API_KEY` | For Brave    | —                       | Server-only Brave credential                |
| `API_HOST`             | No           | `127.0.0.1`             | Bind address (`0.0.0.0` in the container)   |
| `API_PORT`             | No           | `8787`                  | API port                                    |
| `RATE_LIMIT_MAX`       | No           | `30`                    | Requests per IP and owner per minute        |
| `RUN_QUERY_LIMIT`      | No           | `20`                    | Maximum catalog queries in one run          |
| `RUN_RESULT_LIMIT`     | No           | `100`                   | Maximum normalized findings in one run      |
| `PROVIDER_TIMEOUT_MS`  | No           | `8000`                  | Per-attempt provider timeout, 1–30 seconds  |
| `LOG_LEVEL`            | No           | `info`                  | Fastify/Pino log level                      |

Generate the owner token with a cryptographically secure password manager or platform secret facility. Never prefix secrets with `VITE_`, commit `.env`, put provider keys in GitHub Pages settings, or pass them in URLs.

## Future adapters

The provider interface records availability, authentication, supported scope types, provenance, and errors. Candidate future adapters include Mojeek's official API and carefully bounded exact-domain RDAP/DNS/CT/archive/code-search enrichment. TLD-wide CT, archive, GitHub, or DNS enumeration will remain disabled or tightly capped.
