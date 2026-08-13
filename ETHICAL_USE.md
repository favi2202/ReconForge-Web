# Ethical use policy

ReconForge Web is designed for authorized, passive open-source intelligence and defensive exposure review. It organizes search queries and public-source leads. It is not an exploitation tool, and a result does not prove that a page, account, host, or organization is vulnerable.

## Permitted uses

Use ReconForge Web only when the activity is lawful and you are authorized to perform it, including:

- assessing domains and systems you own or have explicit written permission to review;
- blue-team exposure review and attack-surface inventory;
- brand-protection and threat-intelligence investigations using public information;
- finding public documents or references for defensive remediation;
- education, demonstrations, and tool development with `example.com`, synthetic fixtures, mocked providers, and local test servers.

Authorization should identify the target scope, permitted data sources and query categories, time window, handling rules, and responsible contact. A domain being publicly reachable or indexed is not by itself authorization. The user is responsible for provider terms, robots and access policies where applicable, privacy/data-protection rules, contracts, and local law.

## Prohibited uses

Do not use this project to:

- target a third party without permission, including a well-known company, public institution, individual, or customer;
- exploit vulnerabilities, bypass authentication or access controls, validate stolen credentials, or access non-public data;
- brute-force accounts, scan ports, evade CAPTCHAs or rate limits, rotate proxies to avoid controls, or disguise abusive traffic;
- scrape prohibited search-result HTML or use the connected service as an anonymous/open search proxy;
- download sensitive databases, secrets, credential files, backups, or private source code;
- harass, stalk, discriminate against, deanonymize, extort, dox, surveil, or cause harm to a person or organization;
- collect data indiscriminately at public-suffix scale, recursively enumerate provider results, or bypass broad-scope safeguards;
- remove provenance, misrepresent a lead as a confirmed vulnerability, or publish sensitive findings before the owner can respond;
- interfere with providers, consume someone else's API quota, or violate a provider's terms.

The absence of a technical block is not permission. Do not modify templates, the API, or deployment settings to defeat safety controls.

## Sensitive Exposure Review

The optional Sensitive Exposure Review pack is disabled by default and is intended only for an explicitly authorized, exact-domain review. It identifies possibly exposed indexed pages as leads for manual validation. It must not be used with public-suffix scopes, may not retrieve discovered files or extract credentials, and must remain redacted in previews and logs.

Before enabling it, confirm that:

1. you have current, explicit authorization for the normalized exact domain;
2. the planned categories and providers are within that authorization;
3. findings will be minimized, secured, and disclosed through an agreed channel;
4. you will stop if private data, credentials, or out-of-scope systems appear.

## Responsible workflow

1. Define and record scope, exclusions, authorization, purpose, time window, and data-handling rules.
2. Preview compiled queries and estimated volume. For broad suffix scopes, accept the visible warning, use only low-risk discovery packs, and keep strict limits.
3. Prefer planner deep links or official, documented APIs. Do not automate around provider restrictions.
4. Collect the minimum information needed. Do not automatically visit or download finding URLs.
5. Treat titles, snippets, URLs, and provider classifications as untrusted and potentially stale. Preserve provenance and evidence timestamps.
6. Mark findings as review priorities and manually validate only by methods allowed in the authorization. Record false positives.
7. Secure local projects and exports, redact unnecessary personal or sensitive data, and delete material according to the engagement's retention policy.
8. Report issues privately to the authorized system owner with limitations and remediation-oriented context. Coordinate disclosure.

## Public-suffix and large manual scopes

Scopes such as `*.uz` are exceptionally broad. They are for low-risk aggregate discovery when lawful and justified, not blanket permission to investigate every registrant. ReconForge Web intentionally applies lower query/result limits, requires query preview, excludes sensitive-exposure templates, and disables unbounded CT, archive, GitHub, or DNS enumeration and automatic page retrieval.

Manual target lists must contain only domains covered by the same documented authorization or be separated into projects with their own authorization statements.

## Handling accidental sensitive data

If a result appears to expose credentials, private records, personal data, backups, or restricted source code:

- do not open, download, authenticate with, copy, or redistribute it;
- stop related automated work and record only the minimum metadata needed to notify the owner;
- preserve neither secret values nor unnecessary personal data in notes, screenshots, logs, or reports;
- notify the authorized contact through a secure channel and follow their incident process;
- delete accidental local copies securely when permitted by the engagement and applicable retention rules.

## Operator responsibilities

An operator offering connected mode must keep credentials server-side, require owner authentication, configure an exact CORS allowlist and conservative quotas, monitor abuse without logging sensitive content, and disable the service if control of a token or provider key is in doubt. A public deployment must never subsidize anonymous searches with private quota.

Operators should publish contact and retention information, keep dependencies updated, and follow [`SECURITY.md`](SECURITY.md) and [`docs/threat-model.md`](docs/threat-model.md). They may suspend access that appears unsafe, unlawful, out of scope, or harmful.

## Disclaimer

This policy provides operational guidance, not legal advice. You are responsible for obtaining appropriate authorization and complying with applicable law and provider terms. Project maintainers and contributors do not authorize access to third-party systems and are not responsible for misuse.
