# ReconForge Web export schema 1.0

JSON project exports are strict objects. Unknown keys are rejected on import.

```text
Project
├── schemaVersion: "1.0"
├── id, name
├── authorizationStatement
├── scope: ParsedScope
├── additionalScopes?: ParsedScope[0..24]
├── selectedPackIds: string[0..30]
├── queries: CompiledQuery[0..100]
├── findings: Finding[0..5000]
├── createdAt: ISO 8601
└── updatedAt: ISO 8601

ParsedScope
├── original, normalized, value
├── type: exact-domain | subdomain-tree | public-suffix
├── registrableDomain: string | null
├── publicSuffix
├── includedHostnames
├── exclusions: string[0..100]
├── warning: string | null
├── hardQueryLimit
└── allowsSensitivePack

Finding
├── id
├── url, canonicalUrl
├── title, snippet
├── hostname, rootDomain
├── source, category
├── reviewPriority: informational | low | medium | high
├── firstSeenAt, lastSeenAt
├── provenance: Provenance[1..100]
├── tags: string[0..30]
├── notes
└── status: unreviewed | reviewing | validated | false-positive

Provenance
├── provider
├── queryId
├── query (redacted for sensitive templates)
└── collectedAt
```

Imports are limited to 5 MB before JSON parsing. Fields also enforce string lengths and array limits. URLs must pass the Finding schema and be HTTP(S). Provider credentials and application access tokens are not schema fields.

CSV exports quote every cell and prefix formula-triggering values with an apostrophe. Standalone HTML escapes all project and provider text and includes a restrictive report CSP.
