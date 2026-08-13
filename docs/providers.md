# Provider configuration

## Browser deep links

Google, Bing, DuckDuckGo, and Brave can be selected in planner mode. ReconForge encodes the compiled query into the provider's public search URL and opens it with `noopener noreferrer`. The project does not scrape results or proxy anonymous traffic.

Google Custom Search JSON API is closed to new customers and scheduled to discontinue on January 1, 2027. Bing Search APIs retired on August 11, 2025. DuckDuckGo does not advertise a general web-results API. Their browser-only treatment is intentional; source links and review dates are in [research.md](research.md).

## Offline mock

The mock provider is always available when connected mode is enabled. It returns deterministic synthetic URLs on `example.com`. Use it for development, CI, demonstrations, and deployment smoke tests.

## Brave Search API

1. Obtain an API subscription directly from Brave.
2. Set `BRAVE_SEARCH_API_KEY` only in the API environment.
3. Set `CONNECTED_MODE=true`, a strong `APP_ACCESS_TOKEN`, and an exact `CORS_ALLOWLIST`.
4. Restart the API and check `/health`; `brave.available` should be `true`.

The adapter calls only `https://api.search.brave.com/res/v1/web/search`, requests at most 20 results per query, uses moderate safe search, caps retries at three with exponential backoff, and enforces the configured timeout. The key is sent in `X-Subscription-Token`, is redacted from logs, and never enters API responses.

## URLScan Search API

ReconForge searches existing URLScan observations; it does **not** implement `POST /api/v1/scan` and therefore cannot submit a target for a fresh scan.

1. Create or rotate a URLScan API key with read/search access.
2. Set `URLSCAN_API_KEY` only in the API environment.
3. Select **URLScan historical search** for an exact-domain or subdomain-tree run.

The adapter calls only `https://urlscan.io/api/v1/search/`, sends the key in the `api-key` header, requests at most 20 newest results without pagination, and validates the documented response fields. Each result links to the URLScan evidence page and carries a structured subject hostname. The shared scope boundary checks that hostname—including exclusions—before accepting the result. See the official [Search endpoint](https://docs.urlscan.io/apis/urlscan-openapi/search) and [search-field reference](https://docs.urlscan.io/pages/search-api-reference).

## Shodan Host Search API

ReconForge queries Shodan's existing host index; it does **not** implement any `/shodan/scan` endpoint, streaming feed, exploit search, or host-refresh operation.

1. Rotate or obtain a Shodan API key with Host Search access.
2. Set `SHODAN_API_KEY` only in the API environment.
3. Select **Shodan host search** for an exact-domain or subdomain-tree run.

The adapter calls only `https://api.shodan.io/shodan/host/search`, requests page 1 with `minify=true` and an explicit field allowlist, and accepts at most 20 normalized observations. The official API requires the key as its `key` query parameter; ReconForge constructs that URL only inside the server adapter and never logs, returns, or persists it. Findings link to Shodan's host evidence page, while their structured subject hostname is independently checked against the scope and exclusions. Filtered searches can consume query credits, so the default Shodan budget is deliberately conservative. See the official [Shodan REST API reference](https://developer.shodan.io/api).

## Shared adapter protections

- Fixed HTTPS origin and path; redirects are rejected.
- No client-supplied destination and no raw-query endpoint.
- Server recompilation from a known template ID and a parsed scope.
- Two MiB streaming response cap, strict runtime schemas, bounded text fields, timeouts, cancellation, and no-store caching.
- At most three attempts for retryable `429`/5xx failures; other 4xx responses are not retried.
- Global run/query/result caps plus separate daily provider budgets.
- Provider keys remain server-only and are omitted from health, run, finding, export, and error payloads.

## API environment variables

| Variable                    | Required     | Default                 | Purpose                                        |
| --------------------------- | ------------ | ----------------------- | ---------------------------------------------- |
| `CONNECTED_MODE`            | No           | `false`                 | Enables `/v1/*`; must be explicitly `true`     |
| `APP_ACCESS_TOKEN`          | When enabled | —                       | Owner bearer token, minimum 32 characters      |
| `CORS_ALLOWLIST`            | No           | `http://localhost:5173` | Comma-separated exact origins; no wildcards    |
| `BRAVE_SEARCH_API_KEY`      | For Brave    | —                       | Server-only Brave credential                   |
| `URLSCAN_API_KEY`           | For URLScan  | —                       | Server-only URLScan credential                 |
| `SHODAN_API_KEY`            | For Shodan   | —                       | Server-only Shodan credential                  |
| `API_HOST`                  | No           | `127.0.0.1`             | Bind address (`0.0.0.0` in the container)      |
| `API_PORT`                  | No           | `8787`                  | API port                                       |
| `RATE_LIMIT_MAX`            | No           | `30`                    | Requests per IP and owner per minute           |
| `RUN_QUERY_LIMIT`           | No           | `20`                    | Maximum catalog queries in one run             |
| `RUN_RESULT_LIMIT`          | No           | `100`                   | Maximum normalized findings in one run         |
| `PROVIDER_TIMEOUT_MS`       | No           | `8000`                  | Per-attempt provider timeout, 1–30 seconds     |
| `BRAVE_DAILY_QUERY_LIMIT`   | No           | `200`                   | Brave requests per API-instance 24-hour window |
| `URLSCAN_DAILY_QUERY_LIMIT` | No           | `100`                   | URLScan requests per instance 24-hour window   |
| `SHODAN_DAILY_QUERY_LIMIT`  | No           | `25`                    | Shodan requests per instance 24-hour window    |
| `LOG_LEVEL`                 | No           | `info`                  | Fastify/Pino log level                         |

Generate the owner token with a cryptographically secure password manager or platform secret facility. Never prefix secrets with `VITE_`, commit `.env`, put provider keys in GitHub Pages settings, or place them in user-controlled URLs. Rotate any credential pasted into chat, an issue, a log, or another non-secret channel.

## Future adapters

The provider interface records availability, authentication, supported scope types, provenance, and errors. Candidate future adapters include Mojeek's official API and carefully bounded exact-domain RDAP/DNS/CT/archive/code-search enrichment. TLD-wide Shodan, URLScan, CT, archive, GitHub, or DNS enumeration remains disabled.
