# Query template authoring

Templates live in `packages/templates/src/catalog.ts`. They are original project data and implement the `QueryTemplate` type from `@reconforge/core`.

## Required metadata

Each template has a stable ID, pack ID, name, description, category, supported scope types, supported providers, query template, variables, tags, review priority, analyst explanation, safety level, and explicit-authorization flag.

Built-in variables are:

- `{{scope}}`: provider-specific `site:` boundary plus validated exclusions.
- `{{domain}}`: registrable domain, or the public suffix for a suffix scope.
- `{{host}}`: normalized hostname without `*.`.

Do not concatenate user-entered operators into catalog strings. Custom visual-builder values use a separate allowlisted grammar that rejects operator names and special syntax.

## Safety classification

- `low`: broad public-information discovery; may support public-suffix planner scopes.
- `guarded`: exact or domain-tree authorization needed; disabled until an analyst chooses the pack.
- `sensitive`: exact-domain only, disabled by default, explicit confirmation required, preview/log redaction, lead identification only.

Admin, backup, configuration, source-code, and sensitive-exposure templates must declare `supportedScopeTypes: ['exact-domain']` and `requiresExplicitAuthorization: true`.

## Adding a template

1. Choose a durable kebab-case ID; never silently repurpose an existing ID.
2. Add the template with `make(...)`.
3. Add its ID to exactly one pack.
4. Write a plain-language explanation that does not imply a vulnerability.
5. Add or update catalog/compiler tests.
6. Run `npm run test:coverage`, `npm run lint`, and `npm run typecheck`.
7. Add an entry to `CHANGELOG.md` when the catalog behavior changes.

Do not import third-party dork databases without documented license compatibility and attribution. Search syntax should be minimal, defensible, and bounded.
