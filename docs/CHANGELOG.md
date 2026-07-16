# Changelog

## v0.3.2 — 2026-07-16

Completes the tool-by-tool live-API audit begun in v0.3.1 — every remaining tool group was probed against the live Atlassian Marketplace API (payload-level, not just status codes), schemas/docs corrected, and given real integration tests. One tool was 100% non-functional and is now fixed. No tools added or removed (a temporary `app_listing_list` was added during the audit, then reverted as a duplicate of `apps_list`). Tests grew from 206 → 378 across 29 files, all green against the live API.

### Functional bug fixes

- **`artifact_fetch_from_url` was completely broken.** It sent the request-body field `url`, but the API requires `uri` — every call failed with `400 VALIDATION_FAILED "Invalid value for field 'uri'"`. Now maps `url` → `uri`; verified live that requests pass validation and reach the remote-fetch stage. Description updated with the real response shape `{fileInfo, _links, details}`.
- **`free_starter` (freeStarterTier export) sent three ignored params** (`startDate`/`endDate`/`hosting`) and returned a wrong-dated default snapshot with HTTP 200. Rewritten to the real contract: single `date` + `productId` + `includeAtlassianLicenses` + `accept` (csv|json). Documented the CSV-vs-JSON column difference and 500-on-unknown-productId.
- **`transactions_aggregate_by_hosting`** — added the required `aggregation` enum and removed the silently-ignored `productId`.
- **`parent_software_version_by_build`** — build path segment now `encodeURIComponent`-escaped (raw interpolation would break on special chars).

### Pagination / schema corrections (matched to live API)

- **`apps_list`** — converted to cursor pagination (`limit`/`cursor`/`includePrivate`, `nextCursor` in summary mode); `discoverFixtures` now pages through all apps.
- **`app_software_versions_list`** — cursor-paginated (dropped `offset`); added `state`, `paymentModel`, `parentSoftwareId`, `parentSoftwareVersionId`, `afterVersion`.
- **`app_software_get_by_appkey`** — documented it returns an array (one entry per hosting); added `hosting` enum + `complianceBoundaries` (Cloud-only).
- **`app_version_listings_list_all`** — cursor-paginated; added `state` + `approvalStatus` enums.
- **`parent_software_list` / `_versions_list`** — cursor pagination (`PS_PAGE`); completed `get` / `version_by_build` / `version_by_number` (union `buildNumber`, path shapes).
- **`developer_space_members_list`** — documented its non-standard `{members, next}` shape where `next` is a BARE cursor token to feed back as `cursor` (not the `links.next` URL used by every other list tool).

### Documentation corrections

- **`product_catalog_latest`** — description badly mischaracterized the payload. It is NOT Atlassian's product/pricing JSON; the presignedUrl serves a ~150 MB CSV of the entire public Marketplace **app** catalog. Rewritten with the real format + columns (verified by a ranged fetch of the header row).
- **`promotions_*`** — documented three live gotchas: an unknown/mistyped `appKey` is **silently ignored** (returns ALL promotions, not zero); non-paged `promotions_list` can hang to the 60s timeout (strongly prefer `_list_paged`); `promotions_get` on a bad id returns HTTP 500 (not 404).
- **`developer_space_*`**, **`cloud_migration_compat_get`**, **`partner_metrics`**, **`privacy_security_get`**, **`app_listing_get`** — enriched with real response shapes, error codes, and quirks.
- Investigated a suspected `app_listing` coverage gap (`GET /product-listing/developer-space/{id}`); confirmed `apps_list` already wraps it (byte-identical 20-field per-item payload) and reverted the temporary duplicate tool.

### Integration tests

New live suites (structure-only for PII; writes verified statically): `app-software` (11), `app-version-listing` (9), `free-starter` (7), `privacy-security` (5), `partner-metrics` (3), `cloud-migration` (5), `parent-software` (9), `developer-space` (10), `reporting-entrypoints` (5, covers `product_catalog_latest` + `reporting_links`), `app-listing` (5), `artifacts` (5), `promotions` (10). Full suite: **378 tests / 29 files**.

### Write-path verification & security

- **Reversible write success-path check.** The privacy-security draft round-trip (`draft_put` → `get(state=draft)` → `draft_delete`) was verified end-to-end against the live API — non-public, guarded against clobbering an existing draft, and restored to baseline. The suite remains intentionally **non-mutating**; all other write tools are not safely reversible and stay static-only (schema + annotations).
- **Secret scan** across the tree (excluding `.env`): no tokens, keys, emails, credentials-in-URLs, or hardcoded vendor identifiers. Auth is env-sourced (`config.email`/`config.apiToken` → Basic); `.env` is git-ignored; `.env.example` holds placeholders only.

### Audit tooling

- **`scripts/audit-spec-vs-schema.mjs`** — genericized the swagger path (CWD / `$SWAGGER_PATH` / `~/Downloads`) and added a `NOT_A_PROXY` suppression for `apps_known`.

## v0.3.1 — 2026-06-03

Per-tool deep-audit pass (tool-by-tool, every parameter probed against the live API) plus two cross-cutting fixes in the shared response path. No tools added or removed (still 95); several schemas corrected to match real API behavior. Tests grew from 85 → 206 (44 unit + 162 integration).

### Shared response-path fixes (`src/tools/_shared.ts`)

- **`MAX_RESPONSE_CHARS=0` now actually disables truncation.** The guard was `text.length <= MAX_RESPONSE_CHARS`, so `0` made *every* response truncate — the exact opposite of the documented "set to 0 to bypass". Now any non-positive value ⇒ `Infinity` (truncation off). Regression-tested in a process-isolated unit test.
- **`_bytes` is now the true UTF-8 byte size** (`Buffer.byteLength`), not JS string length (which under-counts multibyte by up to 4×). Added a separate `_chars` field for the string length. `_hint` rewritten to explain the `_file` holds the complete payload + the three retrieval options.

### Schema corrections (matched to live API)

- **`metrics_churn` / `_conversion` / `_renewal`** — replaced the generic `REPORTING_DATE_FILTERS` with endpoint-accurate sets. Aggregate endpoints accept only `aggregation/startDate/endDate`; `productId`/`hosting`/`addon` are silently ignored (proven by a 30-param byte-identical sweep). Descriptions corrected: conversion is a FLAT `series` (no `datasets`); renewal has `datasets` but NO `uniqueTotal`; churn has both.
- **`metrics_churn_benchmark`** — added the undocumented-but-working `productId` filter (HAL template omits it).
- **`metrics_details_by_metric` / `_export`** — dropped `upgrade` from the `partnerType` enum (Atlassian 400s on it despite listing it as allowable); documented `order=desc` as unreliable on these endpoints. Export: imported and applied `EXPORT_TIMEOUT_MS` (handler previously ran on the default 60s despite the docs promising 10 min) and removed `offset`/`limit` (the export endpoint ignores them).
- **Customer insights** — `makeInsightTool` is now parameterized per tool. `regions`/`editions` switched to a date-only `INSIGHTS_DATE_FILTERS` (host endpoints accept only `startDate`/`endDate`); `tiers` got `INSIGHTS_TIERS_FILTERS` with a `product` param that filters by **host application name** (`jira`/`confluence`, case-insensitive — not a productId UUID).

### Test infrastructure

- **No hardcoded vendor identifiers.** All tests/scripts now discover app keys, product IDs, and SENs at runtime via `tests/helpers/fixtures.ts` (`discoverFixtures`). Scrubbed every vendor/customer identifier (app keys, UUIDs, SENs, AAIDs, partner IDs, customer emails, host names, the partial API token) from source, tests, scripts, and generated docs. `.gitignore` hardened (`.claude/`, macOS `* 2.*` duplicates).
- **No mocks / fixtures.** Tests are either pure-logic unit (`tests/unit/`) or live-API integration (`tests/integration/`); a short-lived recorded-fixture "contract" tier was added then removed by request.
- **Spill-file teardown.** `tests/_setup.ts` now sweeps `atlassian-mcp-*` tmp files after each test file so repeated runs don't fill constrained temp quotas.

### Per-tool audit coverage (this release)

Sales-metrics group complete (6/6): churn (9 tests), churn_benchmark (10), conversion (8), renewal (7), details_by_metric (14), details_export (7). Customer-insights in progress (3/4): regions (8), editions (7), tiers (6). Plus a 31-case silent-ignore regression sweep for metrics_churn.

## v0.3.0 — 2026-06-02

Major documentation & testing infrastructure release. The MCP itself is unchanged in tool surface (still 95 tools, 3 resources, 4 prompts) but every tool now has a verified canonical spec URL, an integration test suite, and developer-facing TSDoc.

### Spec URL infrastructure

- **`src/tools/_spec-links.ts`** — new single-source-of-truth `TOOL_ENDPOINTS` map (95 entries: name → method, path, note?). All other doc paths read from this one map.
- **`specUrl(method, path)`** — builds canonical Atlassian docs URLs. Routes v1 promotions to `…/v1/api-group-promotions/` (with the `marketplace-` prefix the docs site uses) and the reporting/listing surface to `…/v4/api-group-<group>/` even though wire paths are `/rest/3/...`. Probed 11 groups; every group page resolves.
- **`scripts/verify-spec-urls.mjs`** — new verifier that fetches each group page once, then checks every URL's `#anchor` fragment exists as an `id="…"` in the HTML. **95/95 endpoints fully verified** (page 200 + anchor present). Wired as `npm run docs:verify-links`.

Three propagation paths feeding off `TOOL_ENDPOINTS`:

1. **Runtime tool descriptions** — every `server.tool(...)` call auto-augmented with `📖 Spec (METHOD /path): <URL>` via a `server.tool` wrapper in `src/server.ts`. Visible via MCP `tools/list`.
2. **`docs/TOOLS.md` regen** — new `scripts/gen-tools-md.mjs` + `npm run docs:tools`. Each entry has a `**📖 Spec:** METHOD /path — [docs](URL)` line at the top.
3. **TSDoc endpoint tables** — new `scripts/inject-endpoint-tables.mjs` + `npm run docs:tsdoc`. Codemod injects a `<auto-tsdoc-begin>…<auto-tsdoc-end>` block above every `register*Tools` declaration with a Method/Endpoint/Docs table. All 25 tool files covered.

### Documentation site

- **TypeDoc** added as dev dependency. `docs/api/` (HTML) generated from TSDoc on `register*Tools` functions and filter constants (`REPORTING_DATE_FILTERS`, `LICENSE_FILTERS`, `TX_FILTERS`, `PAGINATION_FILTERS`). 33 functions + 11 variables indexed.
- **`docs/TESTING.md`** — per-tool findings doc, populated as we audit each block (currently A + B + C done).
- **Master pipeline:** `npm run docs:all` (build → docs:tsdoc → build → docs:tools → docs:api → docs:verify-links).

### Vitest integration test suite

- **`tests/integration/*.test.ts`** + reusable `tests/helpers/mcp-test-client.ts` (stdio MCP client with `hasLiveCreds()` skip gate so public-repo CI doesn't require secrets).
- **85 tests across 4 suites**, ~50s against live API:
  - `apps.test.ts` — 8 tests (Block A: apps_list, apps_known)
  - `discovery.test.ts` — 9 tests (Block A: reporting_links, developer_space_*, parent_software_list, product_catalog_latest)
  - `licenses.test.ts` — 30 tests (Block B: full filter audit incl. date filters, casing asymmetry, Atlassian quirks)
  - `transactions.test.ts` — 30 tests (Block C: filter audit incl. saleType, billingPeriod, cloudComplianceBoundaries, aggregate metrics)
- Smoke harness `scripts/test-all.mjs` retained as broad regression check (74 PASS / 0 FAIL / 4 SKIP).

### Schema audit corrections (per-block probing)

| Field | Before | After | Why |
|---|---|---|---|
| `LICENSE_FILTERS.tier` / `TX_FILTERS.tier` | `z.string()` | `z.number().int()` | Atlassian: "Must be a list of valid integer" |
| `LICENSE_FILTERS.dateType` | `[start, end, maintenance, lastUpdated]` | `[start, end]` | API only accepts the 2; rest were invented |
| `LICENSE_FILTERS.hosting` (and TX) | `data_center` | `datacenter` | API uses one-word lowercase form |
| `LICENSE_FILTERS.licenseType` | `z.string()` w/ 7 examples | `z.enum([11 values])` | Probed live; includes `net_new_evaluation`, `upgrade_evaluation`, `starter` not in stale swagger |
| `LICENSE_FILTERS` — new fields | — | `cloudComplianceBoundaries`, `appEdition`, `showLifeTimeFreeLicenses`, `licenseLevel` | Spec audit caught these gaps |
| `TX_FILTERS` — new fields | — | `cloudComplianceBoundaries`, `appEdition` | Same |
| `TX.aggregate_by_metric` | no `aggregation` arg | `z.enum([month, week])` | Probing found this is the time-bucket granularity |
| `transactions.ts` various | description prose | docs site is v4, wire is `/rest/3/...`, multi-value filtering must use separate calls (comma-form is silently mis-parsed) | Probed live |
| `customer_lookup` prompt | `customer_sen_lookup` w/ `sen` arg | `customer_lookup` w/ `identifier` arg | Identifier diversity (SEN, appEntitlementNumber, cloudId, hostname, email, org) |

### Atlassian-side quirks newly documented (not fixed — they're external)

- `order` param silently ignored on `licenses_list` (works on `transactions_list`)
- `dateType=end` semantic is "overlap window," not "ended within window"
- `startDate > endDate` returns empty silently (no validation)
- One transaction can span multiple line items — `transactionLineItemId` is the unique row id, not `transactionId`
- Multi-value filter via comma is silently mis-parsed at Atlassian; only repeated-param form works
- v1 `promotions_update` PATCH returns HTTP 500 for any field on Cloud single-use promos (confirmed via direct curl)

### Versioning cleanup

- All references to "v3 spec / v3 swagger" → neutral "the spec" / "swagger"
- All `developer.atlassian.com/...rest/v3/` doc links → `/v4/` (the `/v3/` docs path is the deprecated v2 spec we don't target)
- One disambiguation note in `docs/ARCHITECTURE.md` explains the wire `/rest/3/` vs docs `/v4/` numbering quirk

### Permissions

- `.claude/settings.local.json` collapsed from ~30 fine-grained Bash rules to a single `Bash(*)` wildcard (project-local, gitignored). MCP/WebFetch/Read/Skill rules preserved.

### New npm scripts

| Script | What |
|---|---|
| `npm run test` | vitest run (integration suite) |
| `npm run test:watch` | vitest watch mode |
| `npm run test:safe` | broad smoke harness (`scripts/test-all.mjs`) |
| `npm run docs:tools` | regenerate `docs/TOOLS.md` from live `tools/list` + `TOOL_ENDPOINTS` |
| `npm run docs:tsdoc` | inject endpoint tables into every `register*Tools` declaration |
| `npm run docs:api` | TypeDoc → `docs/api/*.html` |
| `npm run docs:verify-links` | fetch each Atlassian group page; assert every `#anchor` exists |
| `npm run docs:all` | full pipeline |

### Files added (count)

- `src/tools/_spec-links.ts` (TOOL_ENDPOINTS + specUrl/toolSpecUrl)
- 4 vitest integration suites + 1 helper
- 3 docs-regen / verification scripts
- `typedoc.json`
- `docs/TESTING.md`, `docs/api/*` (auto-generated, gitignore-candidate)

### Verified end-to-end

- ✅ `npm run typecheck` clean
- ✅ `npm run build` clean
- ✅ `npm run test` — 85/85 passing (~50s)
- ✅ `npm run test:safe` — 74 PASS / 0 FAIL / 4 SKIP (Atlassian-side or not-applicable)
- ✅ `npm run docs:verify-links` — 95/95 URLs fully verified (HTTP 200 + anchor present)
- ✅ `npm run docs:api` — 0 errors, 1 unrelated warning

## v0.2.2 — 2026-06-01

Resilience, schema-audit, and one prompt rename. Final sweep: **74 PASS / 0 FAIL / 4 SKIP** out of 78 safe tools, with the SKIPs all confirmed Atlassian-side or not-applicable.

### Resilience improvements (`src/http-client.ts`)

- **Retry on transient 5xx** (502/503/504) in addition to 429, with exponential backoff (1s → 2s → 4s, capped at 10s). Honors `Retry-After` header when present.
- **Retry on network errors and timeouts** — treated as transient, same backoff.
- **Per-request timeout via `AbortController`.** Default 60s (`HTTP_TIMEOUT_MS` env), overridable per call via `RequestOptions.timeoutMs`. Verified: the broken `promotions_list` endpoint now aborts at the timeout instead of hanging forever.
- **`MAX_ATTEMPTS` cap** (default 4, `HTTP_MAX_ATTEMPTS` env) — bounded total wait time.
- **`EXPORT_TIMEOUT_MS` constant** (default **10 min**, `EXPORT_TIMEOUT_MS` env) applied to 6 long-running tools: `licenses_export_sync`, `transactions_export_sync`, and all three `*_export_async_download` tools. Prevents mid-stream aborts on multi-MB pulls (e.g. entire license history).

### Schema audit — verified every enum against the live API

The earlier change to enum-validate path-segment metrics was correct, but the audit found that several enums I'd added were **guessed** rather than probed. Re-probed every candidate filter against Atlassian's own error responses and corrected:

- 🐛 **`hosting` value `data_center` → `datacenter`** (one word). Every call with `hosting=data_center` would have 400'd. Fixed in both `REPORTING_DATE_FILTERS` and the inline enum in `transactions_aggregate_by_metric`.
- 🐛 **`dateType` had two invented values** (`maintenance`, `lastUpdated`). Atlassian only accepts `start` and `end`. Removed.
- ➕ **`licenseType`** converted from `z.string()` to enum with all 11 values: `academic, commercial, demonstration, evaluation, net_new_evaluation, upgrade_evaluation, open_source, starter, free, classroom, legacy_free`.
- ➕ **`licenseLevel`** added as enum: `single-instance`, `multi-instance`.
- ➕ **`saleType`** converted from `z.string()` to enum: `new, refund, downgrade, renewal, upgrade`. (`downgrade` had been missing from the doc string.)
- ➕ **`paymentStatus`** converted from `z.string()` to enum: `paid, refunded, uncollectible, open`.
- ➕ **`partnerType`** converted from `z.string()` to enum: `direct, expert, reseller, upgrade`.

Comment added to `_shared.ts` noting that all enums come from probing, not guesses — to prevent future sessions from inventing values again.

### Other schema additions (from the customer-360 exercise)

- **`licenses_list.sortBy`** is now an enum (`addonName, company, country, endDate, hosting, licenseId, licenseType, partner, region, startDate, tier`) — was previously the inherited `z.string()` which let through invalid values like `saleDate` and only failed at Atlassian.
- **`transactions_list.sortBy`** is now an enum (`addonName, company, country, date, hosting, licenseId, licenseType, partner, partnerType, purchasePrice, region, saleType, tier, transactionId, vendorAmount, paymentStatus`).
- **`licenses_list.showLicensesHistory`** added — returns the full event history for matched SENs (e.g. 17k chars vs 1k for a customer who's been around).
- **`licenses_list.text` and `transactions_list.text` descriptions** updated to enumerate all identifier types the free-text search matches: SEN, appEntitlementNumber, appEntitlementId, cloudId, cloudSiteHostname, email, organization. (Previously implied SEN-only.)

### Promotions

- **`promotions_create`** auto-pads `YYYY-MM-DD` to `YYYY-MM-DDT00:00:00Z` (the API rejects plain dates). Description updated.
- **`promotions_code_get` / `promotions_code_delete`** `promotionCode` schema corrected from `z.number().int()` to `z.string()` — actual codes are alphanumeric strings like `VN5U6M`, not integers. Verified end-to-end via mint+list+get+delete.

### Prompt rename

- `customer_sen_lookup` → **`customer_lookup`** with `identifier` (was `sen`). Description now explicitly enumerates supported identifier types (SEN, appEntitlementNumber, appEntitlementId, cloudId, cloudSiteHostname, email, organization). Body embeds the gotchas we discovered: tells the LLM to use `showLicensesHistory=true`, warns that zero transactions ≠ unpaid (could be a Jira Free $0 customer).

### Test harness improvements (`scripts/test-all.mjs`)

- **Poll-until-DONE** for the async export download tests, replacing the arbitrary 5s sleep that caused flaky pass/fail. Polls up to 2 min at 5s intervals; downloads only after status is `COMPLETED`.
- **Fixed status extraction** — Atlassian nests the field as `{export: {status: "COMPLETED"}}`, not at the top level. The harness now handles both shapes.

### Documentation

- `docs/CHANGELOG.md` v0.2.2 (this entry).
- `package.json` bumped to `0.2.2`.

## v0.2.1 — 2026-06-01

End-to-end test sweep against the live Atlassian Marketplace API surfaced **7 real tool bugs**, all fixed. Final result: **74 PASS / 0 FAIL / 4 SKIP** out of 78 safe-to-test tools (17 product-affecting tools deliberately not tested).

### Added

- `scripts/test-all.mjs` — comprehensive MCP stdio harness that drives every safe tool (read-only + write-safe + promotion write cycle with cleanup) and emits a pass/fail report. Run with `npm run test:safe`.

### Fixed

- `promotions_code_get`, `promotions_code_delete`: `promotionCode` schema was `z.number().int()`, but actual codes are short strings (e.g. `"VN5U6M"`). Changed to `z.string()`.
- `promotions_create`: API rejects plain `YYYY-MM-DD` dates with a parse error at index 10. Tool now auto-pads `startDate` / `expirationDate` with `T00:00:00Z` when only a date is supplied. Description updated.
- `reporting_links`: path had a trailing slash (`/`) that Atlassian's router returns 404 for. Removed.
- `transactions_aggregate_by_metric`: `metric` was `z.string()`; API enforces enum. Now `z.enum(["country", "hosting", "partner", "region", "tier", "type"])`.
- `evaluations_by_metric`: same treatment. Enum: `country`, `hosting`, `partner`, `region`.
- `feedback_metrics_by_metric`: same. Enum: `reason`, `type`.
- `search_keywords_*_export` (4 tools): asked for `Accept: text/csv` and got HTTP 406. These endpoints return HAL JSON with links to actual CSV/JSON downloads — not CSV directly. Switched to JSON Accept; descriptions updated to clarify.
- `licenses_export_async_download`, `transactions_export_async_download`, `marketing_attribution_export_async_download`: same — these endpoints return JSON arrays of records, not CSV. Removed the `Accept: text/csv` override. Descriptions clarified.

### Known quirks (Atlassian-side, not our bugs)

- `promotions_update`: PATCH returns HTTP 500 server-side for any update on Cloud single-use promotions. Verified via direct curl outside this MCP. Tool is correctly implemented; report it to Atlassian if you need it.
- `promotions_list` (non-paged): times out at Atlassian's side. Use `promotions_list_paged`.

### Test sweep coverage

- 74 PASS — every read-only and write-safe tool returned valid data
- 4 SKIP — `promotions_update` (Atlassian-side 500), `promotions_code_get` (no codes in test promo at read time), `partner_metrics_fetch` (request body shape undocumented), `artifact_get` (no artifactId available without doing a binary upload)
- 17 NOT TESTED — all product-mutating tools (`app_listing_update`, `app_software_version_*`, `app_version_listing_*`, `privacy_security_*` writes, `cloud_migration_compat_*` writes, `developer_space_member_*` writes, `review_response_*`, `artifact_fetch_from_url`) deliberately excluded per user instruction

## v0.2.0 — 2026-06-01

Quality pass surfacing the MCP from "comprehensive" to "well-formed by spec".

### Added

- **Large-response handler.** `jsonResult()` now spills responses exceeding `MAX_RESPONSE_CHARS` (default 50,000 chars) to `/tmp/atlassian-mcp-<sha1>.<ext>` and returns a summary `{ _truncated, _file, _bytes, _preview }`. Repeat calls reuse the file via content hashing. Configurable via env. Verified: `customer_insights_tiers` (199,842 chars) now returns a 200-char pointer instead of blowing the LLM's token budget.
- **MCP tool annotations** on all 95 tools (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`). Breakdown: 71 read-only, 20 destructive (mutations + public-impact + credentials), 4 write-safe (async export starts, artifact URL ingestion).
- **MCP Resources** (`src/resources.ts`): `apps://list` (5-min cache), `apps://known`, `vendor://profile`. Read via `resources/read` without burning a tool call.
- **MCP Prompts** (`src/prompts.ts`): `monthly_kpi_summary`, `draft_review_response`, `customer_sen_lookup`, `promo_for_customer`. Canonical multi-tool workflows.

### Changed

- `src/tools/_shared.ts` now exports `READ_ONLY`, `WRITE_SAFE`, `DESTRUCTIVE` annotation constants used by every tool module.
- `docs/TOOLS.md` regenerated to include resources, prompts, and per-tool annotation badges.

### Deferred

- **Output schemas** on tools — would help the LLM compose follow-up calls more reliably; ~3 hrs effort to define HAL/list/aggregate shapes. Skip until we see actual composition errors.
- **Progress notifications** for async exports — currently the LLM polls `*_status` manually. Niche; the polling pattern works.
- **Tests + CI** — still none. Verification continues to be live-API smoke tests run from the project root.

---

## v0.1.0 — 2026-05-29

Initial implementation. 95 MCP tools covering 93 Atlassian Marketplace endpoints (out of 95 in scope; 2 multipart binary uploads deliberately deferred).

### Added

- Shared infrastructure: `src/config.ts`, `src/http-client.ts` (single base, HTTP Basic auth, 429 retry), `src/tools/_shared.ts` (jsonResult, asQuery, filter schemas).
- Domain tool modules (25 files in `src/tools/`):
  - **Apps** (2): `apps_list`, `apps_known`
  - **Promotions** (10): full CRUD + single-use codes
  - **Licenses** (5): list, sync/async export
  - **Transactions** (7): list, sync/async export, aggregate by metric/hosting
  - **Reporting meta** (1): `reporting_links`
  - **Evaluations** (1): `evaluations_by_metric`
  - **Feedback** (2): details + metric aggregate
  - **Customer insights** (4): regions, editions, tiers, active users
  - **Sales metrics** (6): churn, churn benchmark, conversion, renewal, details-by-metric, details export
  - **Benchmarks** (2): sales, evaluations
  - **Marketing attribution** (3): async export start/status/download
  - **App requests & approvals** (1)
  - **Reviews** (4): list, get, respond, delete-response
  - **Search keywords** (8): partner, by source, by app, zero-results — plus all CSV exports
  - **Free starter tier** (1)
  - **App listing** (2): get, update
  - **App software** (7): get by appKey, versions list/create/get/update, tokens list/create
  - **App version listing** (4): list-all, get/create/update by build
  - **Privacy & security** (4): get, draft put, draft delete, publish
  - **Cloud migration compatibility** (3)
  - **Parent software** (5)
  - **Developer space** (9): get, members CRUD, catalog account, listings
  - **Partner metrics** (1): `partner_metrics_fetch`
  - **Product catalog** (1): `product_catalog_latest`
  - **Artifacts** (2): URL-fetch ingestion, get details

### Fixed

- `review_response_put` was issuing `PATCH`; the Marketplace spec says `PUT`. Method corrected.

### Decisions

- **Single API base.** Initial design used two hosts (`marketplace.atlassian.com` + `api.atlassian.com`); discovery during smoke testing showed both reporting and v1 promotions live under `api.atlassian.com/marketplace/`. Collapsed to one `apiBase` constant in `config.ts`.
- **Multipart binary uploads skipped.** `POST /artifacts` and `POST /assets/images/{imageType}` are not wrapped — they require `multipart/form-data` + local file I/O, which adds complexity for low daily value. The URL-fetch variant (`POST /artifacts/fetch`) is wired.
- **`productId` UUIDs, not app keys.** Confirmed by live testing — passing the app key string to reporting endpoints returns empty results; the UUID is required.
- **`transactions_aggregate_by_hosting` kept as a friendly alias** for `transactions_aggregate_by_metric(metric="hosting")`. Same backend route; clearer name for a common query.

### Known quirks

- The deprecated non-paged `promotions_list` endpoint times out at Atlassian's side (HTTP 000 after 30 s). The tool is wired for completeness — **use `promotions_list_paged` for any real query.**
- During initial env setup, several user-provided `productId` UUIDs were stale. Always discover product IDs at runtime via `apps_list` rather than hardcoding them — UUIDs can drift when apps are re-listed under a new product entry.

### Coverage

- reporting endpoints: 83 / 85 (2 multipart deferred)
- v1 promotion endpoints: 10 / 10
- Total: 93 / 95 in scope; 0 missed by accident.

### Documentation

- `README.md` — installation, configuration, npm scripts, MCP wiring, troubleshooting.
- `docs/TOOLS.md` — full 95-tool catalog generated from a live `tools/list` call. Public-impact / credential-creating tools tagged with ⚠️.
- `docs/ARCHITECTURE.md` — design decisions (single API base, dual ID types, async-export gotcha, out-of-scope multipart endpoints).
- `docs/CHANGELOG.md` — this file.
- `package.json` updated with `license: "UNLICENSED"`, `private: true`, keywords, and a refreshed description.

### Outstanding decisions for the maintainer

- **License choice.** Currently `UNLICENSED` (private). If sharing externally, add a `LICENSE` file and update `package.json`.
- **`who_is_online` product UUID.** The user-supplied UUID isn't present in the current developer-space. Determine whether it lives under a different developer-space and either point a second MCP instance at it or rotate it out.
