# ReconForge Web research and design review

Research snapshot: **2026-08-12**. This is a design study, not a dependency or code-import decision. It reviews public project documentation and current provider documentation. ReconForge Web will use an original implementation and original query templates; no code, bundled wordlists, dork databases, or query corpora from the projects below are copied.

## Executive conclusions

- Build a planner-first product. A static browser application can compile, explain, save, and export queries without putting an owner's search credentials behind an anonymous public proxy.
- Use **Brave Search API** for connected general-web results, **URLScan Search API** for existing historical scan metadata, and **Shodan Host Search API** for existing service observations. Keep the latter two on dedicated provider-native templates rather than translating general web-search operators.
- Keep Google, Bing, and DuckDuckGo as user-initiated browser deep links. Google's Custom Search JSON API is closed to new customers and ends for existing customers on 2027-01-01; Microsoft's Bing Search APIs were retired on 2025-08-11; no official DuckDuckGo general-web-results API was located.
- Treat scope, provenance, and collection budget as first-class data. The strongest architectural ideas recur across Amass, BBOT, Subfinder, Recon-ng, and the reporting platforms: typed observations, modular collectors, per-project workspaces, explicit source chains, normalized records, and deterministic deduplication.
- Keep passive discovery separate from validation. Several reviewed tools combine passive OSINT with brute force, port scanning, fuzzing, crawling, screenshots, or vulnerability scanners. Those capabilities are intentionally outside ReconForge Web v1.
- Prefer review priority over vulnerability severity. Search hits and passive observations are leads, not proof of exposure or exploitability.

## Open-source project review

### 1. OWASP Amass

- **Repository and license:** [owasp-amass/amass](https://github.com/owasp-amass/amass), Apache-2.0 (the repository notes that some subcomponents have separate licenses).
- **Important features:** attack-surface discovery and network mapping; OSINT and active techniques; a centralized asset database; and the Open Asset Model (OAM). OAM makes assets, typed relationships, source, timestamps, and confidence explicit, then normalizes and deduplicates observations before enrichment. See the [official overview](https://owasp-amass.github.io/docs/) and [asset-model description](https://owasp-amass.github.io/docs/open_asset_model/assets/).
- **Strong ideas:** evidence is more useful as a typed, provenance-bearing object than as a line in a text file. Relationships and first/last-seen timestamps make later grouping, audit, and reporting much easier.
- **Weaknesses for this product:** Amass is a broad framework with database and deployment complexity beyond a planner-first web application. It deliberately includes active reconnaissance, while ReconForge Web's mission is passive search intelligence.
- **Conceptually adopt:** typed observations; stable canonical keys; discovery source and time; relation-friendly identifiers; explicit confidence/review state.
- **Intentionally avoid:** copying OAM code or schemas wholesale, graph-database requirements in v1, automatic organization expansion, and active network mapping.

### 2. ProjectDiscovery Subfinder

- **Repository and license:** [projectdiscovery/subfinder](https://github.com/projectdiscovery/subfinder), MIT.
- **Important features:** a focused, modular passive-subdomain collector; curated sources; source selection; time limits; JSON/file/stdout output; wildcard elimination and resolution. The project states that it complies with its passive sources' licenses and restrictions. See the [official overview](https://docs.projectdiscovery.io/opensource/subfinder/overview).
- **Strong ideas:** do one bounded job well; make sources replaceable; expose time budgets; emit pipeline-friendly structured output; distinguish provider configuration from target input.
- **Weaknesses for this product:** it is CLI-first and centered on subdomains rather than analyst-friendly search planning, result annotation, and reporting. Its optional resolution step is a direct interaction with DNS and must not silently redefine "passive."
- **Conceptually adopt:** a small provider interface, availability reporting, per-provider timeout/rate configuration, source attribution, and graceful partial success.
- **Intentionally avoid:** importing its source list or implementation; invoking its binary; unbounded recursive enumeration; presenting DNS resolution as proof that a web asset is in use.

### 3. theHarvester

- **Repository and license:** [laramies/theHarvester](https://github.com/laramies/theHarvester), `GPL-2.0-only` as declared in the current [`pyproject.toml`](https://github.com/laramies/theHarvester/blob/master/pyproject.toml). The repository does not currently expose a top-level license file in its file list, so this metadata should be rechecked before any reuse.
- **Important features:** collects names, email addresses, IPs, subdomains, and URLs from many public providers; current documentation identifies an official Brave Search API integration, optional REST routes protected by an API key, and both passive and active modules. See its [README](https://github.com/laramies/theHarvester#readme).
- **Strong ideas:** one normalized run can combine heterogeneous providers, clearly list which providers need keys, and expose a mockable boundary between collection and presentation.
- **Weaknesses for this product:** very wide source coverage increases maintenance and provider-policy drift. The same application also offers DNS brute force and screenshots, and some listed integrations target breach or people data outside ReconForge Web's narrow defensive scope.
- **Conceptually adopt:** provider capability metadata, server-side keys, and explicit passive/active labels.
- **Intentionally avoid:** copying provider modules or source inventories, people/breach harvesting, DNS brute force, screenshots, and assuming every listed provider remains legal or operational merely because an adapter exists.

### 4. SpiderFoot

- **Repository and license:** [smicallef/spiderfoot](https://github.com/smicallef/spiderfoot), MIT.
- **Important features:** web UI and CLI, more than 200 modules, publisher/subscriber data flow, YAML correlation rules, SQLite storage, visualizations, and CSV/JSON/GEXF export. The same tool can also invoke active scanners and perform web scraping, content analysis, dark-web searching, and other collection. See its [repository README](https://github.com/smicallef/spiderfoot#readme).
- **Strong ideas:** modules publish observations consumed by other modules; correlation is separate from collection; an embedded UI makes results navigable; exports preserve analysis beyond a run.
- **Weaknesses for this product:** a very large module surface creates difficult operational, licensing, privacy, and security review. Passive and active capabilities are available in one scan framework, which makes safety boundaries harder for a public deployment.
- **Conceptually adopt:** event-to-normalization pipeline, correlation after ingestion, saved projects, and multiple safe export formats.
- **Intentionally avoid:** arbitrary plugin execution, scraping modules, Tor/dark-web features, scanner invocation, and any single switch that can turn a passive project into active testing.

### 5. BBOT

- **Repository and license:** [blacklanternsecurity/bbot](https://github.com/blacklanternsecurity/bbot), AGPL-3.0.
- **Important features:** recursive event-driven reconnaissance, typed events, scope distance, target whitelists/blacklists, provenance through parent/module chains, structured outputs, and many input/output modules. Its architecture gives each module incoming/outgoing queues and permits parallel processing. See the official [architecture](https://www.blacklanternsecurity.com/bbot/Dev/dev/architecture/), [event model](https://www.blacklanternsecurity.com/bbot/Stable/scanning/events/), and [scope configuration](https://www.blacklanternsecurity.com/bbot/Stable/scanning/configuration/).
- **Strong ideas:** every event carries type, source module, timestamp, tags, scope description, and parentage. Queue isolation allows cancellation and backpressure without coupling providers to the UI.
- **Weaknesses for this product:** BBOT is intentionally recursive and includes offensive web modules, screenshots, active DNS, port work, and vulnerability findings. Recursion can expand collection far beyond an analyst's initial target if scope distance is misconfigured.
- **Conceptually adopt:** typed provider events, bounded queues, deterministic in-scope checks at both ingestion and expansion, cancellation, and provenance chains.
- **Intentionally avoid:** recursive pivots, affiliate expansion, executable modules, network scanning, YARA/content retrieval, and severity/confidence semantics that imply a validated vulnerability.

### 6. Cert Spotter Open Source Edition

- **Repository and license:** [SSLMate/certspotter](https://github.com/SSLMate/certspotter), MPL-2.0.
- **Important features:** a lightweight Certificate Transparency monitor with exact-host versus domain-tree watch-list syntax, append-only-log auditing, wildcard-certificate handling, hooks, known-certificate authorization, and no database requirement. It monitors both RFC 6962 and static CT API logs. See the [official README](https://github.com/SSLMate/certspotter#readme).
- **Strong ideas:** exact names and domain trees have visibly different syntax and semantics; known/authorized evidence can suppress noisy alerts; robust parsing treats certificates as adversarial inputs.
- **Weaknesses for this product:** the open-source monitor consumes CT logs rather than providing a small on-demand browser application integration. Certificate presence shows issuance, not current DNS ownership or a live service.
- **Conceptually adopt:** visibly distinct exact/tree scope; normalized DNS names; wildcard-aware matching; evidence timestamps; manual false-positive/known-item state.
- **Intentionally avoid:** running a CT-log monitor inside the API service, certificate downloads by default, and treating a certificate name as an active or vulnerable host.

### 7. Recon-ng

- **Repository and license:** [lanmaster53/recon-ng](https://github.com/lanmaster53/recon-ng), GPL-3.0.
- **Important features:** modular OSINT framework; per-engagement workspaces with their own database and reports; module marketplace and credential metadata; database snapshots; scriptable resource files; analysis/reporting through Recon-web. See the [repository](https://github.com/lanmaster53/recon-ng) and official [feature guide](https://github.com/lanmaster53/recon-ng/wiki/Features).
- **Strong ideas:** project isolation, source-to-output module conventions, module metadata that announces credentials/dependencies, snapshots, and repeatable workflows.
- **Weaknesses for this product:** marketplace modules and third-party dependencies create trust and maintenance risk. The framework includes shell execution, optional analytics, and methodology branches beyond passive reconnaissance.
- **Conceptually adopt:** isolated project records, provider metadata, repeatable run manifests, and explicit import/export.
- **Intentionally avoid:** runtime module marketplaces, shell execution, telemetry, arbitrary SQL/query sources, and third-party code installation from the web UI.

### 8. reNgine

- **Repository and license:** [yogeshojha/rengine](https://github.com/yogeshojha/rengine), GPL-3.0.
- **Important features:** database-backed projects, configurable YAML scan engines, parallel scans and subscans, continuous monitoring, result correlation, filters, notes/todos, roles, reports, change tracking, and endpoint deduplication. It also bundles port scanning, fuzzing, screenshots, vulnerability scanners, GPT features, proxy support, and Google dorking. See its detailed [repository README](https://github.com/yogeshojha/rengine#readme).
- **Strong ideas:** an analyst benefits from project dashboards, resumable progress, focused sub-runs, saved filters, changes over time, notes, and intentional report assembly.
- **Weaknesses for this product:** it is a heavyweight multi-service scanner platform. Its broad active feature set, external tool installation, proxy support, AI-generated vulnerability narratives, and concurrency defaults are inappropriate for a safe public planner.
- **Conceptually adopt:** project dashboards, progress/cancellation UX, partial-success states, notes, filters, and first/last-seen change views.
- **Intentionally avoid:** port and vulnerability scanning, directory fuzzing, arbitrary tool installation, proxy rotation, LLM-generated risk claims, automatic issue submission, and content-based endpoint dedupe as the sole canonicalization rule.

### 9. pagodo (Passive Google Dork)

- **Repository and license:** [opsdisk/pagodo](https://github.com/opsdisk/pagodo), GPL-3.0.
- **Important features:** retrieves Google Hacking Database entries and automates searches over them; associates dorks with categories and returns per-query URLs and run timestamps. The README explicitly warns that scraping Google Search results may violate Google's terms. See the [repository documentation](https://github.com/opsdisk/pagodo#readme).
- **Strong ideas:** show a query as a named, categorized unit; retain per-query result provenance; separate query acquisition from execution; capture run start/end.
- **Weaknesses for this product:** the principal workflow scrapes a third-party dork database and automates Google result-page access, includes round-robin proxy support, and uses an external query corpus with separate licensing/provenance concerns.
- **Conceptually adopt:** query categories, per-query explanations, a preview-before-run step, and query-to-result attribution.
- **Intentionally avoid:** all source code and bundled dorks, GHDB scraping, automated Google HTML requests, proxy rotation, and query categories framed around exploitation or credential discovery.

### 10. SearXNG

- **Repository and license:** [searxng/searxng](https://github.com/searxng/searxng), AGPL-3.0.
- **Important features:** self-hosted metasearch that aggregates many search services and databases while avoiding user profiling; configurable engines and output presentation. See the [repository](https://github.com/searxng/searxng).
- **Strong ideas:** keep an engine registry separate from the result model; compile a single user intent into engine-specific requests; disclose engine identity; tolerate an engine failing while others complete.
- **Weaknesses for this product:** many engines obtain results without official provider APIs. Self-hosting does not make upstream scraping permitted, stable, or quota-free, and an open instance can become a search proxy.
- **Conceptually adopt:** provider registry, capability negotiation, normalized result envelopes, and partial failure.
- **Intentionally avoid:** embedding or deploying SearXNG, using unofficial scraping engines, forwarding anonymous searches, and assuming a self-hosted metasearch instance solves provider terms.

### 11. DefectDojo

- **Repository and license:** [DefectDojo/django-DefectDojo](https://github.com/DefectDojo/django-DefectDojo), BSD-3-Clause.
- **Important features:** imports many security-tool formats; normalizes, deduplicates, groups, tracks, remediates, and reports findings; exposes APIs and authentication options. The project describes an end-to-end import/dedup/remediation workflow. See its [official repository README](https://github.com/DefectDojo/django-DefectDojo#readme).
- **Strong ideas:** import is a validated transaction; duplicate identity is deterministic and source-aware; status and analyst decisions live separately from raw evidence; re-import should update rather than multiply findings.
- **Weaknesses for this product:** its model is vulnerability-management oriented and much heavier than a local-first OSINT workspace. A search result should not inherit a vulnerability lifecycle or severity simply because it was imported.
- **Conceptually adopt:** versioned import schemas, import statistics, deterministic canonical hashes, grouping, false-positive state, tags, and clear raw-versus-analyst fields.
- **Intentionally avoid:** DefectDojo's code/schema, vulnerability severity assumptions, enterprise workflow complexity, and automatic remediation/ticketing.

### 12. Dradis Community Edition

- **Repository and license:** [dradis/dradis-ce](https://github.com/dradis/dradis-ce), GPL-2.0.
- **Important features:** portable collaboration and security-report generation; imports from many tools; structured notes, nodes, evidence, and extensible integrations; emphasizes consistent professional reports. See the [official repository README](https://github.com/dradis/dradis-ce#readme).
- **Strong ideas:** an analyst report is a curated deliverable, not a raw result dump; notes/evidence should be organized around assets; offline/portable operation is valuable during an engagement.
- **Weaknesses for this product:** the framework is optimized for pentest collaboration and final reports, not query compilation or provider budgets. Rich note markup and imported documents also enlarge the XSS/file-processing surface.
- **Conceptually adopt:** analyst-controlled inclusion, per-host evidence grouping, consistent templates, offline export, and explicit limitations sections.
- **Intentionally avoid:** rich trusted markup, arbitrary plugins, office-document template processing, and direct reuse of report formats or code.

### 13. Faraday Community

- **Repository and license:** [infobyte/faraday](https://github.com/infobyte/faraday), GPL-3.0.
- **Important features:** multi-user vulnerability management; aggregation and normalization of imported tool data; workspaces; visualizations; CLI/API; report plugins and many tool integrations. See the [official repository README](https://github.com/infobyte/faraday#readme).
- **Strong ideas:** adapters should translate provider-specific records at the boundary; analysts need both manager summaries and record-level detail; imports should be decoupled from the core model.
- **Weaknesses for this product:** server/database and vulnerability-management complexity are unnecessary for local planner mode. Scanner orchestration is outside scope.
- **Conceptually adopt:** a narrow normalized finding envelope, project workspaces, import adapters, per-host summaries, and API/UI separation.
- **Intentionally avoid:** scanner agents, vulnerability semantics, multi-user infrastructure in v1, and direct reuse of plugins, parsers, or data models.

## Cross-project design decisions

The review supports the following original ReconForge Web architecture:

1. **A strict scope object, never a raw string after parsing.** Store original input, ASCII-normalized hostname, registrable domain/public suffix, scope kind (`exact-host`, `domain-tree`, `public-suffix`, or `manual-list`), exclusions, authorization confirmation, and allowed operations. Public-suffix scope gets a distinct capability set rather than a larger wildcard.
2. **Typed, data-driven query templates.** Every template has an ID, version, purpose, category, supported scope kinds, provider compatibility, operator AST, safety level, review priority, variables, and explanation. Compile from an operator AST so target text cannot inject operators.
3. **Provider capability manifests.** Each adapter declares official/deep-link/mock status, authentication, supported scope kinds/operators, maximum page size, run budget, timeout/retry policy, terms/documentation URL, and whether it may execute automatically.
4. **A normalized evidence envelope.** Preserve provider record ID, canonical URL/hostname/root domain, title/snippet as untrusted text, source/provider, query ID and rendered query, observed time, provider time when available, category, tags, and raw-data digest. Never store credentials or authorization headers with evidence.
5. **Deterministic deduplication without destroying provenance.** Canonicalize scheme/host/default port/path/query conservatively; one display record may retain multiple provider/query observations. Keep original URLs for audit. Do not merge merely because page titles or content lengths match.
6. **Analyst judgment is separate.** `reviewPriority`, `analystStatus`, false-positive state, notes, and tags are not provider facts and must not overwrite raw observations. Search discovery is explicitly not proof of a vulnerability.
7. **Bounded asynchronous runs.** A run has a manifest, estimated cost, hard query/result/time caps, provider progress, abort signal, partial success, retry-after handling, and an immutable start/finish record. Public-suffix scope has lower caps and no sensitive pack.
8. **Planner and owner modes share core logic, not secrets.** Scope parsing, query compilation, normalization, imports, and reports run locally. Only authenticated owner-mode requests reach server-side official API adapters. The public site never proxies search traffic through owner quota.
9. **Reports are projections of validated data.** JSON is the lossless source format; CSV neutralizes spreadsheet formulas; Markdown and standalone HTML escape all untrusted values. Reports state scope, authorization, provenance, dates, provider limitations, false-positive warning, and manual next steps.

## Current official provider methods

### General web search

| Provider           | Current official status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ReconForge Web decision                                                                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Brave Search**   | The official [Web Search API](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started) uses `GET https://api.search.brave.com/res/v1/web/search`, authenticates with `X-Subscription-Token`, returns at most 20 results per page, and documents offsets through 9. Its current [operator reference](https://api-dashboard.search.brave.com/documentation/resources/search-operators) includes `site:`, `filetype:`, `ext:`, `intitle:`, phrases, exclusions, and Boolean operators. | **First connected search provider.** Server-side key only; strict query/result caps; obey `more_results_available`; no rich/local expansion. Also offer a keyless browser deep link.                                                      |
| **Mojeek**         | Mojeek documents an official [Search API](https://www.mojeek.com/support/api/search/) over its web index. Its [request documentation](https://www2.mojeek.com/support/api/search/request_parameters.html) uses `/search`, `api_key`, `q`, pagination, and a separate `site` parameter, with JSON or XML responses.                                                                                                                                                                                          | Clean future adapter candidate, not required for v1. Keep provider-specific syntax/capability tests because its controls are not identical to Google/Brave operators.                                                                     |
| **Google**         | The official [Custom Search JSON API](https://developers.google.com/custom-search/v1/overview) is closed to new customers. Existing customers must transition by **2027-01-01**, when the service is discontinued. Google's current help still documents human-search operators such as `site:`, phrases, exclusion, dates, and `filetype:`.                                                                                                                                                                | **Browser deep link only by default.** Do not build a new integration on an ending API and never scrape Google result HTML. A legacy adapter would be inappropriate for a new public project and short-lived even for existing customers. |
| **Microsoft Bing** | Microsoft states that [Bing Search APIs were retired on 2025-08-11](https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement); existing instances were decommissioned. Microsoft still documents [advanced keywords](https://support.microsoft.com/en-US/bing/advanced-search-keywords) for interactive Bing Search. The suggested Grounding with Bing Search product is an LLM grounding service, not a drop-in results-list API for this application.                         | **Browser deep link only.** Do not use obsolete Azure Bing endpoints or treat LLM-generated grounded text as normalized search results.                                                                                                   |
| **DuckDuckGo**     | Official help documents [advanced interactive-search syntax](https://duckduckgo.com/duckduckgo-help-pages/results/syntax), including `site:`, `filetype:`, `intitle:`, and `inurl:`. No official, documented general web-results API was located in the provider's current help. Its Instant Answers are not a substitute for an organic results API.                                                                                                                                                       | **Browser deep link only.** Do not scrape result HTML or misuse undocumented endpoints. Mark some operators experimental because DuckDuckGo itself warns that advanced syntax is not reliable for every query.                            |

The deep-link flow must construct a normal search URL in the browser and require an explicit user action. It must use `noopener,noreferrer`, show the final encoded query, and never fetch or iframe the result page. Manual import is the supported keyless ingestion path.

### Passive enrichment and specialist APIs

| Provider                         | Official method and constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Safe v1 posture                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cert Spotter CT Search API**   | SSLMate's official [CT Search API v1](https://sslmate.com/help/reference/ct_search_api_v1) lists unexpired issuances for a registered domain or subordinate hostname, supports `include_subdomains`, cursor-like `after` pagination, expansion of DNS names, and `Retry-After`. It rejects public suffixes such as `com`. Limited evaluation queries can be unauthenticated; production use requests an API key.                                                                                    | Exact-host/domain-tree only, never public-suffix scope. Cap pages and names, normalize wildcard SANs, retain issuance timestamps/provenance, and use authenticated owner mode for production. Do not expand certificate bodies by default.                                                                          |
| **GitHub REST code search**      | The official [Search API documentation](https://docs.github.com/en/rest/search/search#search-code) describes `GET /search/code`, up to 1,000 results per search, at most 100 per page, a dedicated 10-requests/minute code-search limit, query-length/Boolean limits, and incomplete-result signaling. The page currently contains contradictory authentication wording: its endpoint section says authentication is required, while token metadata says public-only access can be unauthenticated. | Require a server-side fine-grained token in connected mode, exact authorized registrable domains only, small result caps, quoted domain terms, and surface `incomplete_results`. Never fetch repository file bodies or search public-suffix scopes. Reverify authentication behavior during adapter implementation. |
| **Internet Archive Wayback CDX** | The Internet Archive's primary [Wayback CDX Server documentation](https://github.com/internetarchive/wayback/blob/master/wayback-cdx-server/README.md) documents exact, prefix, host, and domain matching; JSON output; field selection; filtering; collapse; limits; and pagination. It labels the API **BETA**, and its repository documentation is old even though the endpoint remains in use.                                                                                                  | Exact-host/domain-tree only, explicit small `limit`, selected metadata fields, `collapse=urlkey`, timeout/cancellation, caching, and clear beta/availability errors. Never request a public suffix or retrieve archived page bodies automatically.                                                                  |
| **RDAP**                         | [ICANN describes RDAP](https://www.icann.org/rdap/) as the structured successor to WHOIS. The authoritative [IANA DNS bootstrap registry](https://data.iana.org/rdap/dns.json) maps TLDs to RDAP base URLs and is actively published; clients append the standardized domain lookup path to the applicable service.                                                                                                                                                                                 | Exact registrable-domain information only. Cache the bootstrap file, validate the selected base URL against that file, allow only HTTP(S) RDAP destinations returned by IANA, cap redirects/body/time, and expose redaction/registry variability. Do not perform reverse registrant or public-suffix enumeration.   |
| **DNS over HTTPS**               | Cloudflare documents an unauthenticated [DoH endpoint](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/) supporting standard wire format and a provider-specific JSON format; Google documents both [RFC 8484 and JSON endpoints](https://developers.google.com/speed/public-dns/docs/doh). Cloudflare warns that the JSON schema is not an IETF standard.                                                                                                    | Use one documented resolver adapter for explicit names and a fixed allowlist of record types. No arbitrary resolver URL, AXFR, brute force, reverse sweeps, or ANY-as-enumeration. Prefer RFC 8484 wire format in the backend; mocks in CI.                                                                         |

### Sources considered but not integration contracts

- `crt.sh` is useful interactively, but a stable, official public API contract and production limits were not found in its primary documentation during this review. Do not make its commonly used JSON query behavior a required v1 dependency.
- Google Hacking Database is a third-party query corpus. Its individual entries and collection terms were not license-audited here, so no GHDB content will be imported.
- SearXNG instances and unofficial search libraries are not official-provider APIs. Their technical availability does not grant permission to proxy or scrape an upstream engine.
- Censys, SecurityTrails, VirusTotal, and similar services remain deferred. Shodan is included only through its official existing-host search endpoint with an explicit field allowlist, page-one/result caps, conservative credit budget, and no on-demand scan method. URLScan is similarly search-only; no scan submission is implemented.

## Shipped providers and bounded roadmap

The shipped v0.2 provider surface remains intentionally small:

1. `browser-google`, `browser-bing`, `browser-duckduckgo`, and `browser-brave`: local URL compilation only; no credentials and no result fetching.
2. `mock-search`: deterministic synthetic responses for development, demonstration, unit/integration tests, and end-to-end tests.
3. `brave-search`: authenticated owner-mode general-web search adapter.
4. `urlscan-search`: authenticated historical scan-metadata search through `GET /api/v1/search/`; no URL submission or result-body retrieval.
5. `shodan-host-search`: authenticated page-one search of Shodan's existing host index; no scan request, stream, exploit search, or refresh operation.

Future adapters, subject to a fresh terms/security review, are Cert Spotter for capped CT metadata, IANA-bootstrapped RDAP, metadata-only Wayback CDX, authenticated GitHub code search, and explicit-name DNS-over-HTTPS. None of these future candidates is represented as implemented in v0.2.

Suffix-wide projects such as `*.uz` should therefore remain primarily a **query-planning** exercise. They may compile low-risk browser queries after a visible warning, but automatic CT/archive/GitHub/DNS collection stays disabled. RDAP applies to a registrable domain, not to the suffix itself.

## Licensing and attribution posture

- The project review is attribution for ideas, not notice of incorporated code.
- No reviewed project is a planned runtime or source dependency.
- GPL/AGPL projects can be studied for ideas, but no code, templates, UI assets, schemas, or query lists will be copied into the MIT-licensed ReconForge Web codebase.
- Even permissively licensed source requires preservation of license/notice terms if later incorporated. Any future reuse must be logged in a third-party notices file after a file-level license review.
- Provider response data has provider terms independent of an SDK's software license. Store only what is needed for the analyst record, document retention limits, and never expose a server credential in exports.

## Uncertainties and revalidation checklist

Provider policies and APIs are more volatile than the core application. Before release, and on each provider-adapter update:

- Recheck provider documentation, pricing, acceptable-use/terms, attribution requirements, rate limits, pagination, and data-retention restrictions. This review confirms technical methods, not legal approval for every deployment.
- Recheck the Google discontinuation date and ensure no Google API credentials/configuration are presented to new users.
- Recheck the GitHub code-search authentication contradiction and API version header; keep the adapter owner-authenticated regardless.
- Treat Wayback CDX as best-effort because its primary documentation calls it beta and does not promise a public SLA.
- Recheck Cert Spotter's free evaluation allowance and use authenticated service for production.
- Refresh the IANA RDAP bootstrap at runtime with a bounded cache. Some entries currently use plain HTTP, so the implementation must make an explicit policy decision: reject non-HTTPS entries or proxy them through a separately reviewed service; do not silently weaken transport security.
- Test operator behavior against synthetic/mocked responses. Search operators are provider-specific and may produce approximate or no results even when syntactically accepted.
- Do not describe a repository as "actively maintained" solely from stars or a recent crawl. Activity, security posture, and dependency health require a separate release-time audit.

## Primary-source index

- Tool repositories: [Amass](https://github.com/owasp-amass/amass), [Subfinder](https://github.com/projectdiscovery/subfinder), [theHarvester](https://github.com/laramies/theHarvester), [SpiderFoot](https://github.com/smicallef/spiderfoot), [BBOT](https://github.com/blacklanternsecurity/bbot), [Cert Spotter](https://github.com/SSLMate/certspotter), [Recon-ng](https://github.com/lanmaster53/recon-ng), [reNgine](https://github.com/yogeshojha/rengine), [pagodo](https://github.com/opsdisk/pagodo), [SearXNG](https://github.com/searxng/searxng), [DefectDojo](https://github.com/DefectDojo/django-DefectDojo), [Dradis CE](https://github.com/dradis/dradis-ce), and [Faraday](https://github.com/infobyte/faraday).
- General and passive-intelligence providers: [Brave Web Search API](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started), [URLScan Search endpoint](https://docs.urlscan.io/apis/urlscan-openapi/search), [URLScan search fields](https://docs.urlscan.io/pages/search-api-reference), [Shodan REST API](https://developer.shodan.io/api), [Mojeek Search API](https://www.mojeek.com/support/api/search/), [Google Custom Search JSON API status](https://developers.google.com/custom-search/v1/overview), [Microsoft Bing API retirement](https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement), and [DuckDuckGo search syntax](https://duckduckgo.com/duckduckgo-help-pages/results/syntax).
- Enrichment providers: [Cert Spotter CT Search API](https://sslmate.com/help/reference/ct_search_api_v1), [GitHub REST Search API](https://docs.github.com/en/rest/search/search), [Internet Archive CDX server](https://github.com/internetarchive/wayback/blob/master/wayback-cdx-server/README.md), [ICANN RDAP](https://www.icann.org/rdap/), [IANA RDAP DNS bootstrap](https://data.iana.org/rdap/dns.json), [Cloudflare DoH](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/), and [Google Public DNS DoH](https://developers.google.com/speed/public-dns/docs/doh).
