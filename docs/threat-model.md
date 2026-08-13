# ReconForge Web threat model

- **Status:** security baseline for v0.1
- **Last reviewed:** 2026-08-13
- **Review trigger:** any new provider, server-side network capability, authentication model, persistence layer, import/export format, or deployment topology

ReconForge Web is a passive reconnaissance planner and results workspace. It helps an authorized analyst formulate searches and organize public-source leads; it does not validate vulnerabilities or grant permission to test a target. This document defines the minimum security properties of both operating modes and provides testable design requirements.

## Security objectives

1. A public planner deployment cannot consume or reveal the owner's provider credentials.
2. Connected mode is an authenticated, bounded job runner, not an anonymous search proxy or arbitrary URL fetcher.
3. A scope, template, imported file, or provider response cannot become executable code, trusted HTML, a spreadsheet formula, an arbitrary server-side request, or an unbounded workload.
4. Broad public-suffix work is visibly different from exact-domain work and is restricted to low-risk, low-volume discovery.
5. Logs, errors, telemetry, reports, browser storage, and build artifacts contain no credentials or authorization tokens.
6. Every finding retains provenance and is described as a lead/review priority, never proof of a vulnerability.
7. Development and CI use synthetic targets and mocked providers only.

## Scope and assumptions

In scope are the browser application, local IndexedDB data, imports and exports, the optional API, its provider adapters, application authentication and rate limiting, deployment configuration, build and dependency pipeline, and links opened to third-party providers.

The following are explicit non-features: active scanning, port scanning, authentication bypass, credential validation or extraction, file downloading, arbitrary HTTP fetching, provider-HTML scraping, CAPTCHA bypass, proxy rotation, and automatic retrieval of pages found in results.

The user's browser, imported content, URL parameters, templates, provider responses, DNS/CT/RDAP/archive data, HTTP headers, and all client-supplied identity or quota headers are untrusted. An owner access token authorizes use of a configured connected service; it does not establish authorization to assess a particular third-party domain. The operator remains responsible for target authorization.

## System and data flow

```text
                         public Internet / provider trust boundary
                                      |
                                      v
+----------------+   HTTPS   +-------------------+   fixed adapters   +----------------+
| Browser        |---------->| Optional API      |------------------->| Official APIs  |
|                |           | connected mode    |                    | passive sources|
| - planner      |<----------| - authentication  |<-------------------|                |
| - IndexedDB    | validated | - quota/budgets   | validated response +----------------+
| - import/export|   JSON    | - provider allowlist
+-------+--------+           | - redacted logs   |
        |                    +-------------------+
        |
        +---- user gesture ----> provider search/deep-link page
        |
        +---- validated file ---> local filesystem / spreadsheet / report viewer
```

Planner mode runs entirely in the browser and must be buildable and deployable without API credentials. A user gesture may open a provider search URL, but the application does not retrieve the search page. Connected mode accepts only structured, schema-validated job requests and dispatches them through named, preconfigured adapters. It never accepts a client-supplied destination URL.

## Assets

| Asset                                           | Required property                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Provider API keys and application access tokens | Confidential; server-only; absent from client bundles and exports                           |
| Provider quota and service availability         | Protected from anonymous use, amplification, and unbounded jobs                             |
| Authorization and scope intent                  | Explicit, accurate, preserved in projects and reports                                       |
| Projects, notes, findings, and imported reports | Integrity and local confidentiality; treated as untrusted on rendering                      |
| Query templates and compiled queries            | Syntactically valid, bounded, type/scope compatible, resistant to operator injection        |
| Finding provenance                              | Immutable source/query/timestamp association; clear partial-error state                     |
| Application and dependency supply chain         | Reproducible, reviewed, and free of secrets                                                 |
| Operator/browser safety                         | No script execution, unsafe navigation, formula execution, or automatic sensitive retrieval |

## Actors and likely abuse

- An unauthenticated Internet user attempts to spend the owner's search quota or turn the API into a general-purpose proxy.
- An authenticated but careless or malicious user submits broad, malformed, oversized, or high-concurrency jobs.
- An attacker controls a provider result/snippet, imported project/report, custom template value, domain-like input, or linked URL.
- A malicious site attempts cross-origin calls with a user's token or uses a crafted link/import to induce execution.
- A dependency or build step attempts to exfiltrate secrets or inject browser code.
- A legitimate analyst accidentally applies sensitive templates outside a specifically authorized exact-domain scope.
- An observer obtains logs, client bundles, exports, screenshots, crash reports, caches, or browser storage.

## Trust boundaries

### Browser to application API

Crossing data: access token, normalized scope manifest, selected template IDs, provider selection, run options, progress/cancellation requests, and normalized findings.

Controls: HTTPS outside local development; exact CORS origin allowlist; no wildcard-plus-credentials configuration; application-token authentication before expensive parsing/provider work; strict JSON content type and body limit; runtime schemas that reject unknown fields; per-principal and per-IP rate limits; job/query/result budgets; server-calculated provider destinations; generic errors; no reflected authorization values. CSRF tokens are not a substitute for authentication. If authentication later moves to cookies, use `Secure`, `HttpOnly`, `SameSite=Strict` cookies and add explicit CSRF protection.

### API to external providers

Crossing data: provider-specific compiled query/scope and provider credential; returning metadata and search results.

Controls: adapters own a compile step and a fixed HTTPS origin/path allowlist; provider credentials come only from server configuration; redirect following is disabled or each hop is revalidated; private, loopback, link-local, multicast, metadata-service, and non-HTTP(S) destinations are unreachable by construction; timeouts, response-size caps, bounded retries with jitter, and cancellation propagate to the network request; responses are schema-validated before normalization. Providers must not receive the ReconForge application access token.

### Untrusted content to browser DOM

Crossing data: snippets, titles, URLs, hostnames, tags, notes, imported content, provider errors, query explanations, and generated reports.

Controls: render as text through framework escaping; never use raw-HTML rendering for untrusted values; sanitize only if a future feature genuinely requires a restricted markup subset; validate outbound schemes and allow only `https:`/`http:` where appropriate; open new tabs with `noopener,noreferrer`; use a restrictive Content Security Policy; standalone HTML exports use an escape function for every value and include no active script or remote resource.

### Imports and exports

Crossing data: user-selected JSON/CSV/report files and generated JSON, CSV, Markdown, HTML, query lists, and scope manifests.

Controls: explicit file selection; byte-size limit before parsing; accepted extension and media-type hints plus content validation; runtime schema and version validation; maximum nesting, strings, arrays, targets, queries, and results; reject unknown/unsupported versions and dangerous prototype keys; parse JSON as data only; no dynamic code evaluation; no embedded URL retrieval; transactional import that does not overwrite an existing project without confirmation. CSV cells beginning, after optional leading whitespace, with `=`, `+`, `-`, `@`, tab, carriage return, or line feed are neutralized before quoting. All CSV values are RFC 4180 escaped. HTML output is inert and escaped.

### Browser storage and local user boundary

IndexedDB is convenient persistence, not a secure vault. Store no provider or application access token persistently by default; retain connected-mode tokens in memory or a user-controlled session mechanism. Provide clear project deletion and export controls. Treat all data read back from storage as untrusted and schema-validate migrations. Warn users that anyone with access to the browser profile may access local projects.

### Source, CI, release, and deployment

Controls: committed lockfile; pinned CI action revisions (prefer full commit SHA); least-privilege workflow permissions; no provider credentials for pull-request jobs; synthetic/mock-only tests; secret scanning; dependency audit; reviewed updates; reproducible production builds; artifact inspection for secret names/values and source maps; protected release workflow; no untrusted PR code running with secrets. Production owner mode and public planner mode are deployed separately when practical.

## Mandatory bounded-work defaults

Implement limits in shared schemas and enforce stricter or equal values independently at the API boundary. Configuration may lower these defaults; raising them is a security-sensitive change that requires threat-model review.

| Resource                             |          Planner/default |              Connected exact domain | Connected public suffix |
| ------------------------------------ | -----------------------: | ----------------------------------: | ----------------------: |
| Scopes per project                   | 100 manual exact domains |                      25 targets/run |            1 suffix/run |
| Request JSON body                    |                      n/a |                             256 KiB |                 256 KiB |
| Import file                          |                    5 MiB |                                 n/a |                     n/a |
| Templates/compiled queries per run   |   preview warning at 100 |                                 100 |       20, low-risk only |
| Results per query                    |                      n/a |                                 100 |                      25 |
| Results per run                      |                      n/a |                               2,000 |                     250 |
| Concurrent provider requests per run |                      n/a |                                   3 |                       1 |
| Provider request timeout             |                      n/a |                          10 seconds |              10 seconds |
| Overall run timeout                  |                      n/a |                           5 minutes |              60 seconds |
| Provider response body               |                      n/a |                               2 MiB |                   1 MiB |
| Retry attempts                       |                      n/a | 2 for retry-safe transient failures |                       1 |

The API must also enforce configurable per-IP and per-authenticated-principal token buckets. A safe initial policy is 30 inexpensive API requests/minute and at most 5 job starts/hour per principal, with provider-specific daily budgets. Authentication failures receive a separate, tighter IP bucket. Return `429` with a bounded `Retry-After`; never retry `401`, `403`, validation failures, or quota-exhausted responses. Do not trust `X-Forwarded-For` unless a configured trusted proxy overwrites it.

## Scope and query safety invariants

1. Parse input as a scope grammar, not as a URL. Reject schemes, credentials, ports, paths, query strings, fragments, IP literals, whitespace/control characters, Unicode confusables not safely converted by IDNA, empty labels, malformed wildcards, and wildcard positions other than a single leading `*.`.
2. Use a maintained Public Suffix List implementation. Store both the user's original input and canonical ASCII lower-case normalized form. DNS label/name length constraints apply.
3. Scope types are distinct: exact/root domain, exact subdomain, subdomain tree, public-suffix wildcard, and manual list. A public-suffix wildcard never silently becomes an exact domain.
4. Exclusions pass through the same parser and may only narrow the included scope.
5. The server reparses and reclassifies the scope; it never trusts a client-provided `scopeType`, authorization flag, compiled query, estimated count, or safety level.
6. Templates are selected by stable server-known ID in connected mode. User input fills typed variables with per-variable length/character constraints. Do not accept arbitrary compiled query strings at a generic connected endpoint.
7. Provider compilers build an abstract query representation and escape/quote values according to provider grammar. Target values cannot introduce operators, parentheses, quotes, newlines, or comments. After compilation, enforce an encoded request/query-length maximum.
8. Equivalent normalized abstract queries deduplicate before budgets are reserved. Deduplication cannot be used to bypass per-request template or scope limits.
9. Admin, backup/configuration, source-code, and Sensitive Exposure Review templates require an exact authorized-domain scope. Sensitive Exposure Review is disabled by default, unavailable for suffix-wide scopes, requires a fresh explicit confirmation bound to the normalized exact scope, and is redacted in previews, progress events, logs, analytics, and generic error reports.
10. Suffix-wide work displays a warning, requires preview before execution, permits only an explicit low-risk template allowlist, uses lower budgets, and disables automatic retrieval, CT/archive/GitHub/DNS enumeration unless a separately reviewed adapter provides a hard cap.

## Threats, controls, and verification

| ID  | Threat / abuse case                                                                                                                                                                 | Design and mitigation                                                                                                                                                                                                                                                                                                                            | Required verification                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01 | **Search-provider quota abuse / anonymous proxy abuse.** Attackers use the public site or stolen token to consume owner quota, enumerate arbitrary queries, or amplify requests.    | Connected mode off by default; planner contains no provider secrets; authenticate before work; exact CORS allowlist; fixed provider and template allowlists; no raw query or destination parameter; per-IP, per-principal, per-provider, per-run, and daily quotas; concurrency caps; cancellation; owner-visible quota state.                   | Unauthenticated and invalid-token requests fail before adapter invocation; forbidden origins receive no CORS grant; quota/concurrency tests return `429`; tests prove arbitrary URL/raw query fields are rejected; inspect static bundle for secrets. |
| T02 | **API-key or access-token leakage.** Secrets reach bundles, logs, errors, reports, URLs, telemetry, source maps, or provider requests.                                              | Server-only environment variables; startup validates placeholders/missing secrets without printing values; redact case-insensitive credential/token/header names and known configured secret values recursively; never put tokens in URLs; no token persistence in browser by default; sanitize errors; exports use explicit allowlisted fields. | Canary-secret tests across logs/errors/progress/exports; grep production assets and source maps; provider mock asserts application token is not forwarded; test authorization headers are redacted.                                                   |
| T03 | **SSRF.** Crafted targets, imported URLs, redirects, or provider options make the API contact internal services or arbitrary Internet hosts.                                        | No arbitrary fetch endpoint; provider adapters use compile-time/configured HTTPS origins and fixed routes; do not fetch finding URLs; validate every redirect or disable redirects; DNS data is never reused as a destination; block private/link-local/loopback/metadata/nonstandard ports if any dynamic host is later introduced.             | Route inventory asserts no URL-fetch route; malicious host, scheme, userinfo, port, IPv4/IPv6, DNS-rebinding and redirect fixtures never cause network calls; adapter mock records only allowlisted origins.                                          |
| T04 | **Stored/reflected XSS from snippets, imports, notes, errors, URL parameters, or templates.**                                                                                       | Runtime validation; framework text interpolation; no untrusted raw HTML/DOM insertion; URL scheme allowlist; CSP; inert standalone reports; encode values by output context; no remote content in reports.                                                                                                                                       | Payload corpus covers elements, attributes, entities, SVG/MathML, `javascript:`/`data:` URLs, closing tags, and Unicode edge cases in UI and HTML reports; browser test asserts no script/dialog/network execution.                                   |
| T05 | **CSV/spreadsheet formula injection.** Exported cells execute formulas when opened.                                                                                                 | Neutralize dangerous leading characters after whitespace/control normalization, then apply correct CSV quoting; include every user/provider-controlled column, including titles, URLs, notes, tags, and hostnames.                                                                                                                               | Tests for `=`, `+`, `-`, `@`, tabs, CR/LF, leading spaces, quotes, commas, multiline cells, and normal negative numbers according to documented neutralization policy.                                                                                |
| T06 | **Query/operator injection.** Scope or custom variables break out of quoting, alter target scope, or add high-risk operators.                                                       | Strict scope grammar; typed template AST; provider-aware compiler; variables never concatenate as raw operator syntax; operator selection is enumerated; limits on lengths/counts; server recompiles from IDs and typed variables.                                                                                                               | Fuzz/property tests with quotes, backslashes, parentheses, Boolean operators, newlines, percent encoding, homoglyphs, wildcards, and provider-specific syntax; compiled query remains scope-constrained or is rejected.                               |
| T07 | **Malicious imported report/project.** Oversized/deep JSON exhausts resources, prototype keys alter behavior, hostile strings execute, or imports overwrite data.                   | Pre-parse byte cap; schema/version/unknown-key rejection; max nesting/string/array/result counts; reject `__proto__`, `prototype`, and `constructor`; no reviver/eval/dynamic imports; validate URLs; allocate a new project ID; confirmation before replacement. Parse off the main thread if large allowed files cause UI stalls.              | Fixtures for malformed/truncated/deep/large JSON, unsupported version, duplicate IDs, prototype pollution, XSS, unsafe schemes, excessive results, and atomic rollback.                                                                               |
| T08 | **Excessive result sets and resource exhaustion.** Query explosion, slow providers, retry storms, large responses, event-stream backpressure, or browser rendering causes DoS/cost. | Estimate before run; hard budgets after dedupe; reserve quota atomically; bounded queue/concurrency/retries; deadline and abort propagation; streamed/paginated normalized results; response byte cap; virtualized UI; stop accepting results at cap and surface partial success.                                                                | Tests for Cartesian template expansion, retry/time budget, cancellation, provider ignoring abort, huge body/result count, concurrent job races, partial provider failure, and UI large-fixture responsiveness.                                        |
| T09 | **Sensitive logging and observability leakage.** Queries/results reveal target intent or indexed sensitive strings.                                                                 | Structured allowlist logging; request/run IDs, counts, durations, provider/status only; omit bodies, headers, full URLs/queries/snippets/results/notes; redact before serialization; Sensitive Exposure fields use a redacted marker; restrict retention/access; production debug logging off.                                                   | Canary tokens and sensitive-query fixtures are absent from captured logs, traces, errors, metrics labels, and health endpoints; log-redaction unit tests recurse through arrays/objects/errors.                                                       |
| T10 | **Dependency/build compromise.** Malicious package/action steals secrets or injects code.                                                                                           | Minimal dependencies; lockfile and reproducible install; dependency/reputation and license review; automated audit/update review; pinned actions; least-privilege workflows; no secrets in fork/PR jobs; SAST/secret scanning; release only from reviewed protected commit.                                                                      | CI lockfile-enforced install, audit report, secret scan, licenses, build provenance where available, production artifact inspection; document triage rather than silently ignoring audit findings.                                                    |
| T11 | **Broad-scope misuse.** Public suffix or large manual lists enable indiscriminate collection or sensitive lead generation.                                                          | Strong warning and preview; explicit type classification; low-risk pack allowlist; no sensitive pack; reduced limits; no automatic page retrieval; no TLD-scale CT/archive/GitHub/DNS enumeration; report records breadth and limitations; manual lists bounded.                                                                                 | Tests cannot select or invoke restricted packs/adapters for `*.uz`; tampered client requests are denied server-side; boundary tests cover public/registrable suffixes and IDNs; counts remain under suffix caps.                                      |
| T12 | **Authorization bypass / confused deputy.** Client changes `scopeType`, safety flag, template ID, or confirmation to run restricted work.                                           | Server derives scope class and template policy; authorization confirmation is a typed, timestamped statement bound to normalized exact scope and run, expires quickly, and is auditable without sensitive query text; deny by default for unknown templates/providers.                                                                           | Direct API tests bypassing UI; scope mismatch/expiry/replay tests; unknown or disabled IDs denied; authorization status included in report manifest without secrets.                                                                                  |
| T13 | **CORS, CSRF, and browser-origin abuse.** A malicious origin drives connected requests or reads results.                                                                            | Exact scheme/host/port origin comparison; no regex suffix mistakes, origin reflection, or wildcard with credentials; reject `null` origin for browser use; access token in authorization header; preflight constrained to needed methods/headers; cookie auth, if added, requires CSRF control.                                                  | Origin matrix includes allowed, subdomain spoof, suffix spoof, alternate port/scheme, punycode, `null`, and absent Origin; rejected origins get no permissive CORS headers.                                                                           |
| T14 | **Unsafe outbound navigation / reverse tabnabbing / data exfiltration.** Findings or provider URLs use dangerous schemes or obtain opener/referrer data.                            | Parse URLs; allow only expected HTTPS provider origins for deep links and HTTP(S) for finding links; visible destination; `target="_blank"` paired with `rel="noopener noreferrer"`; no automatic navigation, embeds, prefetch, or downloads.                                                                                                    | Component/E2E tests cover `javascript:`, `data:`, protocol-relative, userinfo/host confusion, encoded schemes, and `window.opener`; link audit checks rel attributes.                                                                                 |
| T15 | **Cache and cross-user data leak.** Authenticated results are cached by a proxy/service worker or shared across users.                                                              | Authenticated API responses use `Cache-Control: no-store`; vary CORS responses by `Origin`; service worker caches only versioned static planner assets, never API/results/imports; stateless API and unpredictable run IDs; authorize every progress/cancel lookup.                                                                              | Cache-header tests; principal A cannot read/cancel principal B's run; offline/cache tests show no connected result replay.                                                                                                                            |
| T16 | **Provider response confusion and provenance spoofing.** Malformed responses or imports claim a false source/time/query.                                                            | Adapter-specific runtime schemas; server sets provider identity, query/template ID, retrieval timestamp and run ID; canonicalization does not discard raw display URL where needed for audit; distinguish provider time from observation time; reject impossible/oversized values.                                                               | Mock malformed providers; client cannot override server provenance; deduped records retain all source/query references.                                                                                                                               |
| T17 | **Open redirect or header injection.** Crafted values influence redirects, filenames, response headers, or logs.                                                                    | No user-controlled redirect endpoint; construct download names from a strict slug and set safe `Content-Disposition`; reject CR/LF/control characters; use framework header APIs; encode path parameters.                                                                                                                                        | CRLF and Unicode filename tests; no arbitrary redirect response; headers remain well formed.                                                                                                                                                          |
| T18 | **DNS/CT/archive enumeration amplification.** Wildcards trigger provider-specific large enumerations even with few logical queries.                                                 | Provider capability declares supported scope types and independent request/result budgets; suffix scopes disabled for these adapters by default; do not recursively expand provider findings; pagination counts toward budget; stop tokens are not blindly followed.                                                                             | Mock unbounded pagination and recursive discovery; adapter stops at cap; capability tests reject unsupported suffix scopes.                                                                                                                           |

## HTTP and browser security baseline

Production responses should set the following, adjusted only with documented justification:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' <explicit-api-origin>; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

Set HSTS on HTTPS API/static deployments after confirming all relevant hosts are HTTPS-only. Avoid `'unsafe-inline'` and `'unsafe-eval'`; if tooling requires inline bootstrapping, use a per-response nonce/hash. Frame embedding is denied. API JSON and report downloads use explicit content types and `nosniff`. Authenticated and sensitive responses use `Cache-Control: no-store`.

## Authentication and authorization design

- Connected mode must require an application access token or an equivalent owner-auth system. Compare static tokens with a timing-safe primitive after verifying equal decoded length; prefer storing a slow hash if tokens are persisted. Tokens require at least 128 bits of CSPRNG entropy, rotation instructions, and independent dev/prod values.
- Do not accept access tokens in query parameters, URL fragments, cookies by accident, or custom identity headers. The canonical form is `Authorization: Bearer <token>` over HTTPS.
- A health/readiness endpoint may be unauthenticated only if it exposes a boolean state and no configuration, provider account, quota, dependency, error, or environment details.
- Run identifiers are not authorization. Bind every read, progress stream, and cancellation request to the authenticated principal.
- Failed authentication is generic and rate-limited. Never reveal whether a candidate token is close, old, or mapped to an account.

## Secrets and configuration

`.env.example` contains placeholders only. The web build accepts only explicitly prefixed public configuration such as the API base URL and deployment base path; it must reject or ignore provider-key names. API startup validates configuration and reports only missing variable names, never values. Logs and error-reporting integrations receive a redaction filter before events leave the process.

For a public planner deployment, omit connected API configuration entirely or point to an operator-owned API whose own authentication and CORS policy are enforced. Public JavaScript cannot keep a secret; consequently, no owner token may be bundled into a public deployment to make connected mode appear automatic.

## Failure handling and safe defaults

- Provider timeout, quota exhaustion, invalid response, cancellation, and partial failure are normal typed outcomes. Preserve already accepted findings and label incomplete runs; do not silently retry beyond the budget.
- If the Public Suffix List, template registry, provider capability, authentication configuration, or limit configuration cannot load, deny connected execution. Planner preview may remain available with an explicit degraded-state warning only when scope safety can still be established.
- Cancellation aborts queued and in-flight provider work, releases concurrency capacity, and cannot cancel another principal's run.
- Never echo raw upstream error bodies. Map them to a stable error code and short safe message; retain only redacted diagnostic metadata.

## Privacy and retention

The stateless API should not persist full findings for v1. Keep the minimum in-memory run state necessary for progress and cancellation, with a short configured TTL and hard cap. If server persistence is introduced, define encryption, tenant isolation, retention, deletion, backup, access logging, and incident response before release. Reports may contain sensitive investigative context; exports should warn users to review content before sharing.

Local projects remain on the device unless the user explicitly exports or sends a connected request. Do not add analytics that capture scopes, queries, findings, notes, complete URLs, or authorization confirmations. Aggregate product telemetry, if ever enabled, must be opt-in or clearly disclosed and use an allowlist schema.

## Security verification gates

Before a release:

1. Run formatting, lint, strict type checking, unit/integration/E2E tests, production planner and API builds, and `git diff --check`.
2. Run security-focused suites for scope bypass, authorization, quotas/races, timeouts/cancellation, SSRF invariants, XSS/escaping, import limits, secret redaction, CSV neutralization, CORS, cache headers, and safe links.
3. Inspect the built browser assets, source maps, Docker layers/history, logs from failing tests, exports, and CI artifacts for canary secrets and forbidden configuration names.
4. Run dependency audit and license review; triage all reachable production findings. Do not describe an audit as clean merely because it exited successfully with ignored findings.
5. Build the container as a non-root runtime with minimal files, a read-only filesystem where deployment permits, no baked-in `.env`, and a pinned base-image digest for releases. Scan the resulting image.
6. Build the planner using the GitHub Pages repository subpath and verify CSP, routing, assets, IndexedDB migration, deep links, and absence of API credentials.
7. Run E2E against `example.com`, synthetic fixtures, local test servers, and mocked provider responses only. Network-deny CI tests so accidental real-provider access fails.
8. Perform a manual adversarial review of every API route, network call site, raw-HTML/DOM sink, URL-navigation sink, import parser, export serializer, log call, environment variable, service-worker route, and template/provider capability declaration.

Suggested release evidence includes exact commands and versions, coverage for core scope/query/normalization/reporting packages, security-test names, the audit report disposition, built artifact checksums, container scan summary, and the commit SHA.

## Residual risk and accepted limitations

- Public search results can be wrong, stale, malicious, or misleading. Normalization and review priority do not establish vulnerability or ownership.
- Browser-local storage is accessible to anyone with the unlocked browser profile and potentially to a successful same-origin compromise.
- A valid owner token can consume bounded quota. Limits reduce impact; they do not replace secure token handling and monitoring.
- Deep links send the compiled query to the selected provider under that provider's policies and the user's browser session.
- Public-suffix classification depends on the bundled Public Suffix List version. Keep it updated and test private/public suffix behavior intentionally.
- Redaction reduces accidental disclosure but cannot make arbitrary logging safe; allowlist logging remains the primary control.

## Security sign-off checklist for new providers or features

A reviewer must be able to answer yes to all applicable items:

- Is the provider official/terms-compatible, useful, and represented by a fixed adapter rather than a generic proxy?
- Are supported scope types, authentication, provenance, request/result budgets, pagination, redirects, timeouts, cancellation, and response schemas explicit?
- Can no client value choose the network origin, credential, safety classification, or final compiled query outside typed variables?
- Do broad-scope and Sensitive Exposure policies fail closed on both client and server?
- Are all new untrusted values traced through DOM, link, log, import/export, header, and persistence sinks?
- Are tests synthetic/mocked and network-denied in CI?
- Are new dependencies and configuration variables documented, licensed, audited, and absent from browser artifacts if secret?
- Has this threat model, `SECURITY.md`, `ETHICAL_USE.md`, and the provider/deployment documentation been updated where needed?
