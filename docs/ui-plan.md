# ReconForge Web UI design reference

This document preserves the product-design checklist used during implementation. The shipped v0.2.0 application uses compact hash routes (`/new`, `/planner`, `/run`, `/results`, and `/reports`) with the active project owned by the local project library, rather than the nested route sketches below. Unchecked items are forward-looking refinements, not claims about the current release; current behavior is documented in the README and architecture guide.

## Foundation

- [ ] Configure Vite base path and hash routing for reliable GitHub Pages refreshes.
- [ ] Add the application shell, semantic landmarks, skip link, route heading focus, error boundary, and not-found recovery page.
- [ ] Define dark SOC tokens, system typography, spacing, focus rings, status chips, buttons, form controls, dialog/drawer, table, and empty/error components.
- [ ] Verify text, focus, and state-color contrast; support `prefers-reduced-motion`.
- [ ] Add IndexedDB repositories and a versioned migration path; keep remote tokens out of durable project records.

## Routes and workflows

- [ ] `/`: local project list, honest local statistics, planner/connected badge, empty state, create CTA, and demo CTA.
- [ ] `/projects/new`: project name, authorization statement, create/import/demo choices, and duplicate-name handling.
- [ ] `/projects/:id`: derived Scope → Plan → Collect → Review → Report progress and resume action.
- [ ] `/projects/:id/scope`: multiline input, strict parser feedback, normalized manifest, exclusions, provider syntax, breadth/query estimate, and stale-plan warning.
- [ ] `/projects/:id/planner`: pack selection, exact query preview, deduplication provenance, safety explanations, provider compatibility, budget summary, and query export.
- [ ] `/projects/:id/runs/:runId`: provider progress, textual counts, cancellation, timeout/quota state, partial-result preservation, and resume after refresh.
- [ ] `/projects/:id/results`: URL-backed filters, desktop table/mobile cards, grouping, detail drawer/sheet, notes, status, false positive, tags, indicators, and safe links.
- [ ] `/projects/:id/reports`: preview, limitations, frozen snapshots, JSON/CSV/Markdown/HTML/query-list/scope-manifest downloads.
- [ ] `/templates`: searchable, filterable read-only catalog with intent, variables, compatibility, restrictions, and version.
- [ ] `/settings/providers`: browser-provider explanation, optional API URL/token session, capability check, connected limits, and disconnect.
- [ ] `/about`: architecture, methodology, ethical use, passive versus active distinction, and false-positive warning.

## Safety-critical UX

- [ ] Require query preview before execution.
- [ ] Never provide `Open all`; open one deep link only from a direct gesture with `noopener,noreferrer`.
- [ ] Treat `*.uz` and other suffix scopes as broad: persistent warning, low caps, low-risk packs only, no automatic retrieval.
- [ ] Hide or explain disabled exact-domain-only packs for non-exact scopes.
- [ ] Keep Sensitive Exposure Review off by default, redacted in preview/logs, gated by explicit authorization, and unavailable for suffix scope.
- [ ] Render snippets/imported values as text, not HTML; neutralize CSV formulas and validate file size/schema before import preview.
- [ ] Use `review priority`, never claim a vulnerability or use exploit-style language.

## Planner/connected boundary

- [ ] Planner remains fully useful with no API base URL and makes no background search-provider requests.
- [ ] Show connected mode as a capability, not a global behavior toggle.
- [ ] Keep access tokens in memory by default; optional session-only persistence requires explicit choice.
- [ ] Send stable scope/template/provider identifiers; server reparses, reauthorizes, and recompiles rather than trusting arbitrary query strings.
- [ ] Disable connected actions with a visible reason when API, authentication, provider, scope, or quota prerequisites fail.
- [ ] Stop client polling on route exit; cancel server work only through an explicit, idempotent Cancel action.
- [ ] Preserve already received results and identify individual provider failures.

## Synthetic demo

- [ ] Seed a deterministic, local-only `example.com` project with manifest, plan, mock run, duplicates, multiple hosts/categories, annotations, false positive, and partial provider failure.
- [ ] Use stable IDs/timestamps and reserved example domains; make zero network calls.
- [ ] Display `SYNTHETIC DEMO` on every related page and export.
- [ ] Support cancellable labelled simulation and scoped `Reset demo` confirmation.

## Responsive and accessible behavior

- [ ] Inspect at 360, 768, 1024, and 1440 px with long scopes, URLs, snippets, and localized-size text.
- [ ] Replace the results table with information-complete cards below 768 px; use a filter sheet with active count.
- [ ] Make drawers full-screen on mobile, restore trigger focus, respect safe areas, and avoid keyboard/sticky-control overlap.
- [ ] Maintain 44 px touch targets and prevent query/URL content from widening the viewport.
- [ ] Label every control; connect help/errors; never depend on placeholder, hover, icon, or color alone.
- [ ] Throttle `aria-live` run updates, expose text progress, and announce cancellation/terminal error once.
- [ ] Complete keyboard-only flows for create, scope, plan, import, annotate, filter, cancel, and export.

## Required UI states and verification

- [ ] Loading, empty, disabled-with-reason, offline, stale, partial-success, quota, timeout, cancellation, expired-token, import-rejection, and report-error states.
- [ ] Component tests for dialogs, focus restoration, pack restrictions, result annotations, and safe outbound links.
- [ ] End-to-end planner flow, demo flow, manual import, report export, connected mock run, cancellation, and page refresh.
- [ ] Automated accessibility scan on every route and meaningful state; manual keyboard and screen-reader smoke pass.
- [ ] Desktop/mobile screenshots from deterministic demo data with no credentials or real targets.
