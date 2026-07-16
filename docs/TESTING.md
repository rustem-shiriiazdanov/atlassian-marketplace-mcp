# Testing strategy & per-tool findings

This MCP has **two test tiers**. No mocks, no recorded fixtures — tests either exercise pure code logic in this repo or hit the live Atlassian Marketplace API. Mock-based tests give false confidence: they keep passing while the real API drifts underneath.

| Tier | Scope | Requires creds? | Speed | Run with |
|---|---|---|---|---|
| **Unit** (`tests/unit/`) | Pure logic of this codebase: helpers, Zod schemas, URL builder, truncation envelope. No network, no Atlassian. | ❌ | <1s | `npm run test:unit` |
| **Integration** (`tests/integration/`) | Per-tool exhaustive probing against the **live Atlassian API**: inputs, outputs, filter behavior, edge cases, validation, silent-ignore regression. | ✅ | minutes | `npm run test:integration` |
| Smoke harness (`scripts/test-all.mjs`) | All 78 safe tools, 1 happy-path call each, end-to-end | ✅ | seconds | `npm run test:safe` |

`npm test` runs both tiers; integration self-skips when no `.env` is present.

**For a new MCP user:**
```bash
git clone …  &&  npm install  &&  npm run build
npm run test:unit        # validates this repo's code (schemas, helpers) — no creds needed
cp .env.example .env     # fill in 4 required vars (ATLASSIAN_EMAIL etc.)
npm run test:integration # runs every tool against your real developer space
```

When Atlassian changes an endpoint's behavior (e.g. starts honoring a previously-ignored param, or changes a response field), the integration tests will fail against the live API — that's how you find out. Don't add mocks to "stabilize" the tests.

## Block A — Discovery & read tools (in progress)

### `apps_list` ✅

**Schema:** 1 optional boolean (`includeFullPayload`). No required args. `additionalProperties: false` per JSON Schema, **but Zod's runtime is loose** — extra fields are silently stripped, not rejected.

**Default response (no args):**
```json
{
  "count": 10,
  "apps": [
    { "productId": "<UUID>", "appKey": "<reverse-DNS string>",
      "appName": "...", "state": "PUBLIC", "approvalStatus": "APPROVED" },
    ...
  ]
}
```

**`includeFullPayload: true` response:**
```json
{
  "items": [ /* full API records with 20+ fields each: developerId, summary, tagLine,
                images, tags, communityEnabled, developerLinks, thirdPartyIntegrations,
                state, approvalStatus, approvalDetails, slug, cloudComplianceBoundary,
                hostingVisibility, dataCenterReviewIssueKey, marketingLabels, revision */ ],
  "links": {}
}
```

**Verified behaviors:**

- ✅ Returns a compact summary by default (~2.5 KB for 10 apps)
- ✅ `includeFullPayload: false` is identical to omitting the arg
- ✅ `includeFullPayload: true` returns the raw `{items, links}` envelope
- ✅ `summary.count` equals `full.items.length`
- ✅ `productId` is always a UUID (regex-verified)
- ✅ Wrong type on `includeFullPayload` (`"yes"`, `1`, `null`, `[]`) → `result.isError: true` with Zod validation error
- ⚠️ **Unknown extra args are silently dropped** (not rejected). Documented; not changing.
- 📦 Full payload response (~26 KB) is well under the 50 KB truncation threshold, so it's returned inline.

### `apps_known` ✅

**Schema:** No args.

**Response:** Object map `{ <friendly_name>: "<productId UUID>" }`. Source: `PRODUCT_ID_*` env vars at startup, lowercase-snake key.

**Verified behaviors:**

- ✅ Returns the env-loaded map (non-empty in dev env)
- ✅ Every value is a UUID (regex-verified)
- ✅ Every name is `[a-z_]+` (env var transform working)
- ✅ Every entry except `*_legacy` resolves to a real app in `apps_list` (so the env file stays honest)

**Convention:** Names ending in `_legacy` are exempt from the "must match a live app" check, for retaining UUIDs whose dev space we no longer control.

### `reporting_links` ✅

**Schema:** No args.

**Response:** HAL document with `_links` containing 30+ named link groups (`appRequestsAndApprovals`, `cloudChurn`, `cloudConversions`, `cloudRenewals`, `cloudChurnBenchmark`, `cloudEvaluationBenchmark`, `cloudSalesBenchmark`, `customerInsightsLinks`, `evaluationsByCountry/Hosting/Partner`, etc.).

**Verified behaviors:**

- ✅ Returns HAL `_links` map with all major reporting endpoints
- ✅ Each entry is either a single link object or an array of templated links
- 📦 Each link has `href` + `templated: true` + URI Template query params, e.g. `cloudChurn` → `{?aggregation,startDate,endDate}`

**Use case:** programmatic endpoint discovery — useful for the LLM to find the right reporting URL when a new metric type is requested.

### `developer_space_get` ✅

**Schema:** `developerId` (optional, defaults to `MARKETPLACE_DEVELOPER_ID`).

**Response:** `{id, vendorId, name, status, type, organisationId, version}`.

**Verified behaviors:**

- ✅ Defaults work — no args returns the env's dev space
- ✅ Explicit `developerId` arg matching env returns the same record
- ✅ `id` is a UUID; `vendorId` is a number (matches `MARKETPLACE_PARTNER_ID`)
- ✅ `status` is one of `ACTIVE` / `INACTIVE` / `SUSPENDED`
- 📦 `type` observed value: `ATLASSIAN_EXTERNAL` (this vendor); other types may exist for first-party Atlassian devs
- 📦 `organisationId` may be `null` (it is for our space)

### `developer_space_catalog_account` ✅

**Schema:** `developerId` (optional, defaults to env).

**Response:** `{developerId, catalogAccountId}`.

**Verified behaviors:**

- ✅ Both fields are UUIDs
- ⚠️ In our space, `catalogAccountId === developerId`. This may NOT hold for all vendors (some have a distinct catalog account); the test only checks shape, not identity.

### `developer_space_listings` ✅

**Schema:** `developerId` (optional, defaults to env).

**Response:** **Array** (not `{items}`) of developer-profile listing docs. Two entries in our space:

| `type` | `content` keys |
|---|---|
| `DEVELOPER_CORE` | `description, slug, contactDetails, address` |
| `DEVELOPER_WEB` | `logo, supportListing, trustCenterUrl` |

**Verified behaviors:**

- ✅ Returns a JS array, not an object envelope
- ✅ Contains at least `DEVELOPER_CORE` + `DEVELOPER_WEB` entries
- ✅ Each entry has its own `version` for optimistic concurrency
- ⚠️ This is **the vendor profile** (the vendor's account/contact info), **NOT the apps**. Use `apps_list` for apps.

### `parent_software_list` ✅

**Schema:** No args.

**Response:** `{links, parentSoftware: ParentSoftware[]}`. Each entry: `{id, developerId, name, hostingOptions[], extensibilityFrameworks[], state, ...}`.

**Verified behaviors:**

- ✅ Returns ~23 Atlassian parent products as of 2026-06-01
- ✅ `developerId` is always `"Atlassian"` (these are first-party products)
- ✅ `hostingOptions[].hosting` ∈ {`cloud`, `server`, `datacenter`}
- ✅ Includes major products: Jira, Confluence, Bitbucket, Bamboo, Beacon, Compass, Atlassian Analytics, Atlassian Guard, Atlassian Whiteboard, etc.
- 📦 Some products are cloud-only (Beacon, Compass, Whiteboard), some span all 3 hostings (Jira, Confluence, Bitbucket)

### `product_catalog_latest` ✅

**Schema:** No args.

**Response:** `{date, presignedUrl, expiresInSeconds}`.

**Verified behaviors:**

- ✅ `date` is today's date (ISO `YYYY-MM-DD`)
- ✅ `presignedUrl` is a `https://...amazonaws.com/` link
- ✅ `expiresInSeconds` = 300 (5 minutes)
- ⚠️ The endpoint does **not return the catalog itself** — it returns a download URL to the actual file. Follow `presignedUrl` separately with any HTTP client. The file is a **~150 MB CSV** (`binary/octet-stream`) of the entire public Marketplace **app** catalog — NOT Atlassian's product/pricing structure. Original tool description was misleading; fixed in v0.2.2+ and further corrected in v0.3.2 (see Block F completion). Verified 2026-07-16 by a ranged fetch of the CSV header row.

---

## Block A summary

| Tool | Tests | Findings → fixes |
|---|---|---|
| `apps_list` | 12 | 🐛 **Cursor pagination was missing** (spec-audit finding): endpoint is cursor-paginated (`limit`+`cursor`, default 10/page) and also takes `includePrivate`, none of which we exposed — the tool only ever fetched one page. Added all three; summary mode now surfaces `nextCursor` (null on last page). `discoverFixtures` helper updated to page through all apps. Verified: `limit` caps + yields cursor, cursor pages are disjoint, full traversal covers every app, `limit=0`/`includePrivate=bogus` → validated. |
| `apps_known` | 2 | Surfaced 1 stale env entry (`who_is_online_legacy`) — exempted by `_legacy` convention |
| `reporting_links` | 1 | None |
| `developer_space_get` | 2 | None |
| `developer_space_catalog_account` | 1 | Documented that `catalogAccountId` may equal `developerId` for this vendor type |
| `developer_space_listings` | 1 | Documented array (not envelope) response shape |
| `parent_software_list` | 2 | None — verified 23 parent products as of probe date |
| `product_catalog_latest` | 2 | **Tool description fixed** — was misleading; clarified it returns a presigned URL, not the catalog itself |

**17 vitest tests across 2 files, all passing in ~7 seconds against the live API.** All findings folded into either the tool description or this doc.

---

## Block B — Licenses tools

### Filter set common to `licenses_list`, `licenses_export_sync`, `licenses_export_async_start`

20 args. Critical findings:

- **Casing asymmetry**: filter values are lowercase, response values are different case:
  - `hosting`: filter `"cloud" / "datacenter" / "server"`, response `"Cloud" / "Data Center" / "Server"`
  - `licenseType`: filter `"evaluation"`, response `"EVALUATION"`. Same for `"commercial"`, etc.
  - `status`: filter `"active"`, response `"active"` ✓ (both lowercase here)
- **`text` filter** is free-text search across SEN, appEntitlementNumber, appEntitlementId, cloudId, cloudSiteHostname, email, organization. Matches the description we set.
- **`showLicensesHistory: true`** flips the response from "current state only" to "every license event ever" — for our test SEN, 1 row → 10 rows. Useful for customer-360.
- **Boundary**: `limit` accepts 1..50. `limit=0` rejected (`too_small`), `limit=51` rejected (`too_big`).
- **Truncation kicks in at limit≈50**: a full 50-row response is ~80 KB which is over `MAX_RESPONSE_CHARS=50,000`, so `jsonResult()` spills to `/tmp/atlassian-mcp-<hash>.json` and returns `{_truncated, _file, _bytes, _preview}`. Tests handle both branches.

### `licenses_list` ✅

**Response shape:**
```json
{
  "_links": { "self": …, "query": …, "export": [<csv-link>, <json-link>], "next": <pagination-link> },
  "licenses": [License, …]
}
```
**License object** (26 fields): `appEntitlementId, appEntitlementNumber, hostEntitlementId, hostEntitlementNumber, cloudId, cloudSiteHostname, addonKey, addonName, hosting, newBillingSystem, lastUpdated, licenseType, maintenanceStartDate, maintenanceEndDate, latestMaintenanceStartDate, latestEvaluationStartDate, status, tier, contactDetails, extendedServerSupport, licenseSourceType, transactionAccountId, licenseLevel, inGracePeriod, productId, cloudComplianceBoundaries`.

**13 tests:** shape, productId filter, status filter, licenseType filter, hosting filter, text-by-SEN, history toggle, pagination, 4 Zod-rejection cases (`data_center`, `saleDate`, `dateType=maintenance`, `limit=0`, `limit=51`), `limit=50` boundary (with truncation branch).

⚠️ **GDPR redaction observed**: some licenses have `contactDetails.technicalContact.name = "RTBF"` (Right To Be Forgotten) — tests don't depend on contact identity, just shape.

### `licenses_export_sync` ✅

Returns CSV (string), not JSON. Header columns include `addonLicenseId, hostLicenseId, licenseId, addonKey, addonName, licenseType, maintenanceStartDate, maintenanceEndDate, status, hosting, tier, company, country, region, technicalContactName, ...`.

**1 test:** verifies CSV header columns are present.

### `licenses_export_async_start` / `_status` / `_download` ✅

Verified full lifecycle:
1. `start` returns `{export: {id: <UUID>}, _links: {…, status: …, download: …}}`.
2. `status` returns `{export: {id, status}}` — observed values include `COMPLETED`. Even small exports complete in <2 seconds in practice.
3. `download` returns either the inline JSON array of records OR (more commonly, since even a 5-row export is ~80 KB) the truncation envelope pointing at a tmp file.

**5 tests:**

- Full lifecycle (start → poll until COMPLETED → download)
- Bogus `exportId` on status → HTTP 404 surfaced as `isError`
- Race condition: download before COMPLETED → HTTP 404 "Export is being processed"
- Both `status` and `download` require `exportId` — Zod rejects missing arg

### Real-data verification (Block B)

Verified during the audit against the developer space the running creds point to (no specific identifiers are recorded here — they'd differ per vendor):

- A known SEN can be located via text search and its status comes back correctly (active / inactive / cancelled).
- The license's `addonName` matches what `apps_list` reports for the same `productId`.
- A license with an evaluation → paid → tier-change history surfaces the full sequence when `showLicensesHistory=true`.
- `hosting: cloud` filter yields only `hosting: "Cloud"` rows.
- Async export downloads return the full record array, with each record's SEN matching the corresponding `licenses_list` entry.

---

## Block totals so far

| Block | Tools | Tests | Status |
|---|---|---|---|
| A — Discovery & reads | 8 | 17 | ✅ done |
| B — Licenses | 5 | 20 | ✅ done |
| **Total** | **13 / 95** | **37** | — |

## Block C — Transactions tools

### Filter audit vs. swagger

Probed every TX_FILTERS field; verified runtime values against direct curl.

| Filter | Swagger | Our schema | Real bug |
|---|---|---|---|
| `tier` | `array<integer>` | was `z.string()` | 🐛 **Fixed** to `z.number().int()` (same bug as licenses) |
| `cloudComplianceBoundaries` | array | ❌ missing | **Added** enum `[commercial, fedramp_moderate, isolated_cloud]` |
| `appEdition` | array | ❌ missing | **Added** enum `[free, standard, advanced]` |
| `aggregation` (on /sales/transactions/{metric}) | enum `[month, week]` | ❌ missing on `transactions_aggregate_by_metric` | **Added** |
| `saleType` | `[new, refund, renewal, upgrade]` (4 in swagger) | already had 5 incl. `downgrade` | live API confirms 5 — swagger stale |
| `partnerType` | `[direct, expert, reseller]` (3 in swagger) | already had 4 incl. `upgrade` | live API confirms 4 — swagger stale |
| `billingPeriod` | NOT in swagger | already had it | live API accepts `monthly` / `annual` — kept |

### Verified `transactions_list` filter behaviors (per probe)

- `productId` — every result matches ✓
- `hosting=cloud` → `purchaseDetails.hosting = "Cloud"` (case asymmetry, same as licenses)
- `saleType=new` → `purchaseDetails.saleType = "New"` (mixed case in response, lowercase in filter)
- `paymentStatus=paid` — top-level `paymentStatus` field
- `billingPeriod=annual` → `purchaseDetails.billingPeriod = "Annual"`
- `tier=10` → `purchaseDetails.tier ∈ {"10 Users", "Evaluation"}` (Evaluation licenses fall under default tier filter)
- `excludeZeroTransactions=true` — verified no $0 rows
- `cloudComplianceBoundaries=commercial` — accepted
- `appEdition=free` — accepted (returns 0 in dev space — we don't have free-tier apps)

### Atlassian-side quirks (transactions edition)

- **`order` parameter DOES work on `transactions_list`** — confirmed via direct curl, asc vs desc returned different date sequences. *Contrasts with `licenses_list` where order is silently ignored.* So the bug is endpoint-specific, not API-wide.
- **`transactionId` is NOT unique per row** — one Atlassian transaction can span multiple line items (e.g., one PO buying 3 apps). The row-unique id is **`transactionLineItemId`**. Documented in the interface comment.
- **Aggregate responses are huge** — even a single-app, 1-week window returns ~230 KB of `{total, addons, _links}` JSON. The truncation handler spills it to `/tmp` reliably. Tests handle both inline and truncated branches.

### Transaction response anatomy

17 top-level fields + a nested `purchaseDetails` block with 18 sub-fields:

| Top-level | `purchaseDetails.*` |
|---|---|
| `transactionId`, `transactionLineItemId`, `addonLicenseId`, `licenseId`, `addonKey`, `addonName`, `lastUpdated`, `paymentStatus`, `appEntitlementId`, `appEntitlementNumber`, `hostEntitlementId`, `hostEntitlementNumber`, `productId`, `licenseLevel`, `customerDetails`, `partnerDetails`, `purchaseDetails` | `saleDate`, `licenseType`, `hosting`, `billingPeriod`, `changeInBillingPeriod`, `oldBillingPeriod`, `tier`, `changeInTier`, `oldTier`, `parentProductName`, `oldParentProductEdition`, `parentProductEdition`, `purchasePrice`, `vendorAmount`, `discounts`, `saleType`, `maintenanceStartDate`, `maintenanceEndDate` |

### `transactions_aggregate_by_metric` (was missing key arg)

- `metric` (path enum): `country`, `hosting`, `partner`, `region`, `tier`, `type` — all 6 verified to return aggregates
- `aggregation` (NEW — added in v0.2.x): `month` / `week` — controls series cadence
- `productId`, `startDate`, `endDate`, `hosting` — all silently applied even though only `aggregation/startDate/endDate` are formally documented

### `transactions_aggregate_by_hosting`

Friendly alias for `transactions_aggregate_by_metric({metric: "hosting"})`. Test verifies both hit the same endpoint with matching responses.

---

## Block D — Sales metrics tools

Audited 2026-06-02. Tools: `metrics_churn`, `metrics_churn_benchmark`, `metrics_conversion`, `metrics_renewal`, `metrics_details_by_metric`, `metrics_details_export`.

### Schema bugs found and fixed

All 6 tools previously used `REPORTING_DATE_FILTERS` (which expose `productId, startDate, endDate, hosting`). Per the HAL `_links.query.href` template returned by each endpoint, the real accepted params are different per tool — and on every aggregate endpoint, the irrelevant filters are **silently ignored** (same totals returned regardless). Split into three filter sets:

| Tool | Accepted params (HAL template) | Was wrong |
|---|---|---|
| `metrics_churn` | `aggregation, startDate, endDate` | missing `aggregation`; exposed silently-ignored `productId, hosting` |
| `metrics_churn_benchmark` | `addon*, startDate, endDate` | exposed silently-ignored `productId, hosting`; missing `addon` |
| `metrics_conversion` | `aggregation, startDate, endDate` | same as churn |
| `metrics_renewal` | `aggregation, startDate, endDate` | same as churn |
| `metrics_details_by_metric` | `addon*, hosting*, lastUpdated, partnerType*, text, startDate, endDate, sortBy, order, offset, limit` | massively under-specced; missing 8+ params |
| `metrics_details_export` | same as `_details_by_metric` | same |

### Response shapes (canonical)

- **Aggregate (`churn`, `conversion`, `renewal`):** `{_links, total: {name, datasets: [{name, series: [{name, uniqueTotal, elements: [{date, count}]}]}]}, addons: [{addonKey, name, productId, datasets}]}`. `churn` and `renewal` split `total.datasets` by billing period (`Monthly`/`Annual`); `conversion` returns a single flat `series` (no datasets nesting). Series names per metric:
  - churn: `Customers` (denominator), `Cancellations` (numerator)
  - conversion: `Evaluations` (denominator), `Conversions` (numerator)
  - renewal: `Renewal opportunities` (denominator), `Renewals` (numerator)
- **Benchmark:** `{_links, churnBenchmarkPerApp: [{appName, appKey, productId, churnBenchmarkPerMonth: [{year, month, churnedLicenses, totalLicenses, churnRate, isolatedChurnRate, churnRateBenchmark, isolatedChurnRateBenchmark}]}]}`. The `*Benchmark` values are normalized so 1.0 = ecosystem average.
- **Details:** `{_links, events: [{addonKey, addonName, hosting, lastUpdated, eventDate, transactionId, licenseDetails, productId}]}`.

### Atlassian-side quirks (sales metrics edition)

- **Hosting case inconsistency**: details endpoint returns `"Data center"` (lowercase 'c'). Licenses_list returns `"Data Center"` (uppercase 'C'). Filter values lowercase in both.
- **Limit hard-cap at 50** on `/details` — `?limit=100` returns 50, no error. Our Zod also caps at 50.
- **`sortBy` enum is strict**: exactly `addonName, date, hosting, transactionId, licenseId`. Anything else → HTTP 400 with the allowed list. Our schema enforces the enum so the call never leaves the client.
- **Truncation kicks in** for conversion over 12+ month ranges (response ~95 KB, exceeds MAX_RESPONSE_CHARS=50k) — `_truncated:true` summary returned, full payload at `/tmp/atlassian-mcp-<hash>.json`. Test exercises this branch.
- **Conversion datasets can be empty** for narrow ranges even when addons have data — Atlassian quirk, not our bug.

### Deep-audit findings per tool (tool-by-tool cadence resumed 2026-06-02)

#### `metrics_churn`

Real accepted filters (HAL `_links.query.href`): `{?aggregation, startDate, endDate}`. Audit (Probe 4-7): 30 plausible filter names from other reporting endpoints (productId, hosting, addon, addonKey, app, tier, country, region, partnerType, licenseType, status, text, saleType, paymentStatus, billingPeriod, excludeZeroTransactions, withDataInsights, withAttribution, lastUpdated, appEdition, licenseLevel, cloudComplianceBoundaries, includeAtlassianLicenses, sortBy, order, offset, limit, dateType + fabricated `foo`) ALL silently ignored — byte-identical hash to baseline. Locked into `tests/integration/silent-ignore-audit.test.ts` (31 cases).

Aggregation: enum `week|month`, case-sensitive (`WEEK` → 400). Date format: strict `YYYY-MM-DD` (`2026-04-01T00:00:00Z`, `2026/04/01`, `04-01-2026`, `2026-4-1` all → 400). Week aggregation aligns to Sunday and extends startDate backward to the preceding Sunday. `uniqueTotal` is de-duped across the range; sum of weekly counts > uniqueTotal when customers persist across weeks. Reversed range and future-only range return 200 with `datasets: [], addons: []`. No-date defaults trip 341 KB response → truncation envelope.

Tests: 9 in integration + 31 in silent-ignore audit.

#### `metrics_churn_benchmark`

Real accepted filters (verified live, NOT all in HAL template): `addon*, productId, startDate, endDate`. **HAL template is incomplete — advertises only `{?addon*,startDate,endDate}` but `productId` works.**

Multi-value handling:
- `addon` accepts BOTH repeated (`addon=a&addon=b`) AND comma form (`addon=a,b`).
- `productId` accepts ONLY repeated form. Comma form (`productId=A,B`) is silently mis-parsed and returns ALL apps. Asymmetric vs `addon`.

Precedence: when BOTH `addon` and `productId` are passed, `productId` wins (addon silently ignored). Verified by passing a productId of one app and an addon-key of a *different* app, then asserting the response only contains the productId's app.

Invalid productId (non-UUID format or valid-shape no-match): silently ignored, full list returned. Invalid date: clean 400. Reversed range: empty `churnBenchmarkPerApp`. Far-future range: empty (publication lag ~2-3 months — today 2026-06-02, latest data 2026-03).

Response shape: `{_links, churnBenchmarkPerApp: [{appName, appKey, productId, churnBenchmarkPerMonth: [{year, month, churnedLicenses, totalLicenses, churnRate, isolatedChurnRate, churnRateBenchmark, isolatedChurnRateBenchmark}]}]}`. 6 apps total in this dev space (one more than `/churn` — the 6th has only historical data). Default no-filter response is ~60 KB → triggers truncation envelope.

Field invariants: `year` is `\d{4}`, `month` is `\d{2}` with leading zero. `churnedLicenses <= totalLicenses`. Rates are 0-100 (percentages). Benchmarks are positive floats; 1.0 ≈ ecosystem average.

Schema bug fixed: added `productId` to `BENCHMARK_FILTERS`. Description updated to document precedence + lag.

Tests: 10 in integration (A-H + 2 original).

#### `metrics_conversion`

Real accepted filters: `aggregation, startDate, endDate` (HAL template `{?aggregation,startDate,endDate}`). 11-param silent-ignore sweep confirmed all others ignored (productId, hosting, addon, tier, country, partnerType, text, sortBy, limit, offset, foo).

**Response shape differs from churn/renewal** — this was the key finding:
- `total.series[]` is **FLAT** — NO `datasets[]` billing-period split (churn/renewal nest series under `Monthly`/`Annual` datasets).
- Two series: `Evaluations` (denominator) and `Conversions` (numerator). Caller computes rate = Conversions / Evaluations per bucket.
- Series have **no `uniqueTotal`** field (churn's series did).
- `addons[]` carry `series` directly (not `datasets`): `{addonKey, name, productId, series}`.

Default `aggregation=week`. Invalid date → 400 "Must be a date". Reversed range and future-only range → empty `series: []` + `addons: []`. Narrow 1-month range → still populated (NOT empty). Default no-filter response ~150 KB → truncation envelope.

Two description bugs fixed: the tool previously claimed "Same shape as `metrics_churn` (datasets/series/elements)" and "May return empty `total.datasets[]`" — both wrong (conversion has no `datasets` key at all). Rewritten to document the flat `series` shape.

Tests: 8 in integration (A-G + truncation).

#### `metrics_renewal`

Real accepted filters: `aggregation, startDate, endDate` (HAL `{?aggregation,startDate,endDate}`). Silent-ignore sweep (productId, hosting, addon, tier, partnerType, sortBy, limit, foo) all confirmed ignored.

**Shape is a HYBRID** of churn and conversion:
- `total.datasets[]` split by billing period (`Annual`, `Monthly`) — like churn.
- Series: `Renewal opportunities` (denominator) and `Renewals` (numerator).
- BUT series have **no `uniqueTotal`** field — like conversion, unlike churn. (Each series is just `{name, elements:[{date,count}]}`.)
- `addons[]` carry `datasets` (not flat series).

So the three aggregate tools form a matrix: churn = datasets + uniqueTotal; renewal = datasets, no uniqueTotal; conversion = flat series, no uniqueTotal.

Default `aggregation=week` (13 vs 3 month elements over a quarter). Invalid date → 400. Reversed/future ranges → empty `datasets`+`addons`. Caller computes rate = Renewals / Renewal opportunities per bucket.

Description bug fixed: previously claimed "Same shape as `metrics_churn`" — corrected to note the missing `uniqueTotal`.

Tests: 7 in integration (A-G).

#### `metrics_details_by_metric`

Path param `saleMetric` ∈ {churn, conversion, renewal} — **all three verified to return `events[]`** (previously only churn was tested). HAL query template: `{?addon*,hosting*,lastUpdated,partnerType*,text,startDate,endDate,sortBy,order,offset,limit}`.

Event row: `{addonKey, addonName, hosting, lastUpdated, eventDate, transactionId, licenseDetails, productId}` where `licenseDetails` is a nested object `{appEntitlementId, appEntitlementNumber, cloudId, maintenanceStartDate, maintenanceEndDate, monthsValid}`.

Filter behavior (verified live):
- `addon`, `hosting`, `text` (matches appEntitlementNumber/SEN), `lastUpdated` (≥ date), `partnerType` — all narrow correctly.
- `limit` server-capped at 50; Zod also caps. `sortBy` strict enum (else 400).
- `hosting` response case is `"Data center"` (lowercase c) — differs from licenses_list's `"Data Center"`.

**Two Atlassian-side bugs found (2026-06-03):**
- 🐛 `partnerType=upgrade` → HTTP 400, **even though the error message itself lists `upgrade` as an allowable value.** Self-contradictory Atlassian validation. We dropped `upgrade` from the Zod enum (kept `direct, expert, reseller`) so the call is rejected client-side with a clear message instead of a confusing 400.
- 🐛 `order=desc` is **broken** — `sortBy=date&order=asc` is cleanly monotonic ascending, but `order=desc` returns a non-monotonic garbage ordering; with no `sortBy`, `order` is ignored entirely. Documented in the `order` param: prefer `asc` and reverse client-side.

Schema bugs fixed: removed `upgrade` from `partnerType` enum; documented the `order=desc` unreliability + verified-narrowing notes on `text`/`lastUpdated`.

Tests: 14 in integration.

#### `metrics_details_export`

CSV sibling of `metrics_details_by_metric`; shares the same filters via `EXPORT_DETAILS_FILTERS` (= `DETAILS_FILTERS` minus offset/limit). Verified live:
- Returns quoted CSV; **header matches the documented 17 columns exactly** (`addonName,addonKey,hosting,lastUpdated,eventDate,transactionId,licenseId,maintenanceStartDate,maintenanceEndDate,monthsValid,appEntitlementId,appEntitlementNumber,cloudId,inGracePeriod,multiInstanceEntitlementId,multiInstanceEntitlementNumber,appEdition`).
- All 3 saleMetric paths export. `hosting`/`addon`/`sortBy` narrow the CSV (cloud=275, server=94, datacenter≈133 of 502 total over 2024–2026).
- Large CSV (126 KB over a wide window) flows through the truncation envelope → spill file saved as `.txt` (CSV doesn't start with `{`/`[`).

**Two bugs found and fixed (2026-06-03):**
- 🐛 `EXPORT_TIMEOUT_MS` was **not even imported** — the handler ran on the default 60s timeout despite the description promising the 10-minute export timeout. A large export could time out at 60s. Fixed: imported it and added `timeoutMs: EXPORT_TIMEOUT_MS` to the request.
- 🐛 Schema spread the full `DETAILS_FILTERS`, exposing `offset`/`limit` — but the export endpoint **ignores both** (verified: `limit=1` still returned all 502 rows), and the description itself said "no offset/limit". Fixed: introduced `EXPORT_DETAILS_FILTERS` (offset/limit omitted) so the tool no longer advertises params it can't honor.

Tests: 7 in integration (incl. a schema-introspection test asserting offset/limit are absent).

### Customer Insights group (`customer-insights.ts`)

All 4 tools share the `makeInsightTool` helper (now parameterized with a per-tool filter set). The live HAL query templates differ per tool:
- `regions`, `editions`, `active-users`: `{?startDate,endDate}` — date-only.
- `tiers`: `{?startDate,endDate,product}` — also a `product` param (note: `product`, not `productId`).
- **None** accept `productId`/`hosting` (the names `REPORTING_DATE_FILTERS` carries) — silently ignored.

Common response shape: `{_links, usersDistributionPerMonth:[{date, insightsType:[{value:{group:{<key>}, usersDistribution:{usersCount, usersPercent, usersMarketplaceBenchmark}}}]}]}`. The `group` key is the only thing that varies (`region` / `edition` / …). `usersPercent` sums to ~100 per month; `usersMarketplaceBenchmark` is the ecosystem comparison. Date semantics: boundary months inclusive; invalid date → 400; reversed/future ranges → empty.

- **`customer_insights_regions`** — group `region` ∈ {apac, emea, americas, unknown}. Schema bug fixed: was `REPORTING_DATE_FILTERS` → now date-only `INSIGHTS_DATE_FILTERS`. Tests: 8.
- **`customer_insights_editions`** — group `edition` ∈ {free, standard, premium, enterprise}. Same date-only fix. Tests: 7.
- **`customer_insights_tiers`** — the outlier. Group has **two** keys `{product, tier}`: `product` is the HOST app (Jira/Confluence), `tier` ∈ {Evaluation, 1-10, 11-100, 101-1000, 1000+}. `usersPercent` sums to ~100% **per host product** (~200% across two). The `product` filter param is the host NAME (`jira`/`confluence`, case-insensitive) — NOT a productId UUID; anything else → HTTP 400 "Must be a jira or confluence". Uses a dedicated `INSIGHTS_TIERS_FILTERS` (date + product). Tests: 6.
- **`customer_insights_active_users`** — group `activeUsers` ∈ {paid, non-paid} (2 buckets, sum ~100%). Date-only `INSIGHTS_DATE_FILTERS`. Tests: 6.

**Customer-insights group COMPLETE (4/4).**

### Feedback group (`feedback.ts`)

#### `feedback_details`

Raw customer feedback (PII: names + free-text messages). Response `{_links:{self,query,next}, feedback:[{addonKey, addonVersion, applicationKey, applicationVersion, hosting, date, feedbackType, reasonKey, reason, message, fullName, appEntitlementId, appEntitlementNumber, productId}]}`; `_links.next` paginates. HAL template `{?type*,anonymous,reason*,addon*,hosting*,startDate,endDate,text,offset,limit}` **plus `productId`** (works despite being absent from the template). Filter behavior (verified): `type` strict enum uninstall/disable/unsubscribe (invalid → 400 "ChurnType…"); `reason` by reasonKey (bugs, merging, not-meeting-needs, other, project-based, sandbox, usefulness); `anonymous` boolean (true ⇒ empty fullName, false ⇒ attributed; invalid → 400 "Type mismatch"); `addon`/`productId`/`hosting`/`text` all narrow. `sortBy`/`order` silently ignored — dropped from schema. Schema rebuilt as `FEEDBACK_DETAILS_FILTERS` (was the generic date+pagination set, which missed type/anonymous/addon/text and exposed ignored sortBy/order). Tests: 9.

#### `feedback_metrics_by_metric`

Path `{metric}` ∈ {reason, type} (else 400). FLAT `total.series[]` (no datasets, no `uniqueTotal`) — one series per group value (reasonKeys for `reason`, feedbackTypes for `type`) — plus per-app `addons[]`. HAL template `{?aggregation,startDate,endDate}`. Schema bug fixed: was `REPORTING_DATE_FILTERS` (productId/hosting silently ignored) and **missing `aggregation`**; replaced with metric+aggregation+dates. Tests: 6.

**Feedback group COMPLETE (2/2).**

#### `evaluations_by_metric`

Path `{metric}` ∈ {country, hosting, partner, region} (else 400). FLAT `total.series[]` (no datasets/uniqueTotal) — one series per group value (e.g. country names) — plus per-app `addons[]`. HAL template `{?aggregation,startDate,endDate}`. Schema bug fixed: was `REPORTING_DATE_FILTERS` (productId/hosting silently ignored) and **missing `aggregation`**; replaced with metric+aggregation+dates. Note: `metric=country` over a wide window pretty-prints past the 50k truncation threshold (raw ~45k, but `jsonResult` indents) — tests use `hosting`/narrow windows to stay inline. Tests: 7. **Evaluations group COMPLETE (1/1).**

### Benchmarks group (`benchmarks.ts`)

Both `benchmark_sales` and `benchmark_evaluations`: HAL `{?addon*,startDate,endDate}` **plus `productId`** (works despite the template; narrows to one app). `hosting`/`aggregation` silently ignored. Schema fixed: was `REPORTING_DATE_FILTERS` (exposed ignored `hosting`, missing `addon`) → now `BENCHMARK_FILTERS` (productId + addon + dates). Per-month rows carry MoM/YTD growth + `*Percentile` (your rank) + `*BenchmarkAllPartners` (ecosystem). Shape quirk: **sales** wraps in `total` with `salesBenchmarkPerMonth`; **evaluations** wraps in `totals` (plural) with `evaluationBenchmarkPerVendorPerMonth` at total level but `evaluationBenchmarkPerAppPerMonth` at addon level. Tests: 8. **Benchmarks group COMPLETE (2/2).**

### App requests & approvals (`app-requests.ts`)

`app_requests_and_approvals` — benchmark-style aggregate (NOT a list): `{total:{name, appRequestsAndApprovalsPerMonth:[{date, appRequests, appRequestsApproved, appRequestsApprovalRate}]}, addons:[{addonKey, name, productId, appRequestsAndApprovalsPerAppPerMonth}]}`. HAL `{?addon*,startDate,endDate}` + working `productId`. Schema bug fixed: was `REPORTING_DATE_FILTERS` + `PAGINATION_FILTERS` — but there's no list to paginate, so offset/limit/sortBy/order (and hosting) were all silently ignored. Now `productId`/`addon`/dates only. Tests: 5. **COMPLETE (1/1).**

### Marketing attribution (`marketing-attribution.ts`)

Async export triplet: `marketing_attribution_export_async_start` (write-safe POST → `{export:{id}}`), `_status` (`{export:{id,status}}`), `_download` (JSON array; 10-min EXPORT_TIMEOUT_MS; large → truncation envelope). Start HAL template `{?addon*,text,startDate,endDate}` — schema bug fixed: was `REPORTING_DATE_FILTERS` (productId/hosting not in template, missing addon/text) → now addon/text/dates. The export is **param-deduped**: identical params return the same exportId (and often an immediate COMPLETED). Status/download share the generic `/async/export/{exportId}[/status]` path. Tests: 6. **COMPLETE (3/3).**

## Block D COMPLETE — all reporting tools audited tool-by-tool.

## Spec-vs-schema audit (`scripts/audit-spec-vs-schema.mjs`)

New advisory tool: cross-checks every tool's live MCP input schema against the documented parameters in the OpenAPI spec (`swagger.marketplace.v3.txt`), flagging MISSING (spec param we don't expose) and EXTRA (schema prop the spec doesn't list — may be an intentional undocumented-but-working filter). Run it after auditing any tool to catch gaps like the `accept` one.

Findings it surfaced on **already-audited** tools (all verified live before acting):
- 🐛 **`reviews_list` MISSING `sort`** — the real param is `sort=recent|helpful|highest_rated|lowest_rated` (NOT `sortBy`/`order`, which I'd tested and correctly found ignored). Added + tested (highest/lowest_rated verified monotonic by stars).
- **`metrics_details_by_metric` / `_export` MISSING `productId`, `appEdition`** — both verified to filter (productId: all returned events match; appEdition enum free/standard/advanced). Added to `DETAILS_FILTERS`. (`addon` stays as an intentional undocumented-but-working extra.)
- **`feedback_details` MISSING `appEdition`** — verified, added.
- **Deferred batch — `accept=csv|json` on the remaining CSV exports** (`licenses_export_sync`/`_async_start`, `transactions_export_sync`/`_async_start`, `metrics_details_export`, `marketing_attribution_export_async_start`, `free_starter_tier_export`): all verified to work live (csv→CSV, json→JSON array, invalid→400), but adding them touches the http-client Accept-header interplay — tracked for a focused follow-up. (search-keywords' 4 exports already have it.)

The audit also flags not-yet-deep-audited tools (app-version-listings, privacy-security, parent-software, partner-metrics) — those gaps get fixed when their blocks are audited.

**2026-06-03 audit re-run — two real bugs found & fixed on shipped tools:**
- 🐛 **`free_starter_tier_export` was sending the WRONG params.** It used `startDate`/`endDate`/`hosting` (all silently ignored — my range call returned rows dated `2026-07-14`, a default snapshot) instead of the endpoint's real single **`date`** param. It also forced an HTTP `Accept: text/csv` header while the endpoint's format is controlled by a **query** `accept=csv|json` (default JSON) — so despite the "CSV export" name it had been returning JSON. Rewrote schema to `date`/`productId`/`includeAtlassianLicenses`/`accept`; description corrected. Payload-level + parameter-combination verification (not just status codes): `date` genuinely shifts the snapshot (rows dated exactly to the requested date; 2026-04-01→all 04-01, 2025-01-01→all 01-01, default→2026-07-14); `productId` narrows 263→50 all-matching; `accept=csv` gives 1 header + N data rows matching the JSON count; all 4 params compose correctly. **Two Atlassian-side quirks found via combinations:** (a) the CSV OMITS the `productId` column JSON has (11 cols vs 12 keys); (b) a valid-shaped non-existent `productId` returns HTTP 500 (not empty). Tests: 7 (new file).
- 🐛 **`transactions_aggregate_by_hosting` was missing `aggregation`** (its sibling `_by_metric` has it) and exposed a silently-ignored `productId` (verified: byte-identical hash with/without it on the `/hosting` endpoint). Fixed to `aggregation`/dates; note added pointing to `_by_metric(metric=hosting)` for productId scoping.

## Block E — Reviews (`reviews.ts`)

#### `reviews_list`

**CURSOR-paginated** (not offset/HAL). Response `{productId, reviews:[{id, content, stars, date, totalVotes, helpfulVotes, productHosting, isFlagged, authorName, transitionedToFiveStarRating}], cursor, count, averageStars}` — `count` = total reviews, `averageStars` = overall rating, `cursor` = next-page token. Verified: `limit` caps the page, `cursor` paginates to a disjoint page, **`offset` is ignored** (cursor-based). **`hosting` filter (cloud/server/datacenter) is real** — narrows by each row's `productHosting`, invalid value → 400 — even though the response advertises no query template; it was MISSING from the schema and has been added. `stars`/`rating`/`flagged` are NOT filters (ignored). Schema bug fixed: was `productId` + `PAGINATION_FILTERS` (offset/sortBy/order don't apply) → now `productId`/`hosting`/`limit`/`cursor`. Zero-review products return `{reviews:[], count:0}` gracefully. Reviews carry PII (author names, free-text). Tests: 8.

#### `review_get`

Single review by `{productId, reviewId}`; same row shape as the list. A bogus reviewId surfaces an error (not a silent empty). Tests: 3.

#### `review_response_put` / `review_response_delete` (write — NOT executed)

Both alter publicly-visible Marketplace state, so they're verified statically only: correct methods (PUT `/…/response`, DELETE `/…/response`), `DESTRUCTIVE` annotation, required params, and Zod rejects missing `response` before any network call. Tests: 2.

**Reviews group COMPLETE (4/4: 2 read deep-audited, 2 write statically verified).**

### Search keywords (`search-keywords.ts`) — 8 tools, 4 list/export pairs

All are **aggregates, not paginated lists** — `offset`/`limit`/`sortBy`/`order` and `productId`/`hosting` (query) were silently ignored; schemas rebuilt to the real templates. `sourceKey` is a strict enum `marketplace`|`embedded-marketplace` (was free `z.string()`). Per-tool:

- `search_keywords_partner` — `{?aggregation,startDate,endDate}` → `{total:{searchAppearances, topSearchKeyword}, addons:[{…, leadingSearchKeyword, searchAppearances, elements}]}`.
- `search_keywords_by_source` — `{sourceKey}` + `{?startDate,endDate}` → `{details:[{searchKeyword, percentage}]}` (flat share, no time series, no aggregation).
- `search_keywords_by_app` — `{productId}` (path) + `{?aggregation,startDate,endDate}` → `{summary, details:[{searchKeyword, keywordCount, elements}]}`.
- `zero_search_results_keywords` — `{sourceKey}` + `{?startDate,endDate}` → `{details:[{searchKeyword, count}]}` (SEO gap).

**Export tools — three findings (all were mis-documented):**
1. **by_source & zero-results exports return the FULL DATA directly** as a JSON array (up to 500 rows), NOT links. Verified live — each row is `{searchKeyword, percentage}` (by_source) or `{searchKeyword, count}` (zero-results).
2. **partner & by_app exports return data INLINE** (`total`+`addons` / `summary`+`details`) — identical payload to their list siblings, wrapped with an `_links.export`.
3. 🐛 **The `_links.export` CSV/JSON download URLs are BROKEN (Atlassian-side).** The href has a doubled path `…/search-keywords/export/export?…&accept=csv` and **404s on every format** (verified live for both partner & by_app). So "follow `_links.export` to download" is impossible — consumers must use the inline data. Descriptions corrected to warn; a test asserts the href still contains the known-broken `/export/export` (so we'd notice if Atlassian fixes it).

Old descriptions claimed all four "return links to CSV/JSON downloads"; all corrected.

**Source dimension (`sourceKey`):** two sources — `marketplace` (public marketplace.atlassian.com search) and `embedded-marketplace` (in-product "find apps"). They return DISTINCT datasets (different top keywords). 🐛 **But zero-results only supports `marketplace`** — `embedded-marketplace` is rejected with HTTP 400 "source: allowable value is 'marketplace'". Fixed: `zero_search_results_keywords` + its export now use a restricted `SK_SOURCE_ZERO` enum (`marketplace` only), while the other source tools keep both.

### App-listing & App-software (`app-listing.ts`, `app-software.ts`)

`app_listing_get` — single-object product-listing metadata by productId (no query params). Read, clean.

`app_software_get_by_appkey` — returns an **ARRAY** of `{appSoftwareId, hosting, complianceBoundaries, archived}`, one per hosting the app supports. Schema bug fixed: added `hosting` (real filter — narrows to 1 entry, verified) + `complianceBoundaries`. Data quirk: `complianceBoundaries` is Cloud-only (array for cloud, **null** for server/datacenter).

`app_software_versions_list` — `{links, versions:[{buildNumber, versionNumber, compatibilities, supportedPaymentModel, ...}], totalCount}`. Schema bugs fixed: it's **CURSOR-paginated** (had wrong `offset`; now `limit`+`cursor`), and was **missing** `state`, `paymentModel` (enum, invalid→400), `parentSoftwareId`, `parentSoftwareVersionId`, `afterVersion`. Verified: cursor pages disjoint, offset ignored, paymentModel filters.

`app_software_version_get` — one version by buildNumber (chained). `app_software_tokens_list` — `{tokens:[{token, cloudId, instance}]}`, credential-adjacent (token ids + customer cloud sites); added the spec's `token` lookup param.

3 destructive writes (`version_create`, `version_update`, `token_create`) — verified statically only (methods POST/PUT, `DESTRUCTIVE` annotation, required params); never executed. Tests: 11. **App-listing/software reads COMPLETE; writes static.**

### App-version-listing (`app-version-listing.ts`)

`app_version_listings_list_all` — per-version published metadata (`{screenshots, highlights, moreDetails, youtubeId, developerLinks, approvalStatus, state, buildNumber, appSoftwareId, revision}`). Schema bug fixed: **despite the name it's CURSOR-paginated** (default 10/page — was completely unparameterized) and was **missing** `state` (PRIVATE/PUBLIC) + `approvalStatus` (APPROVED/SUBMITTED/REJECTED/UNINITIATED). Payload-verified: cursor pages disjoint; `state` narrows (PUBLIC→all PUBLIC, PRIVATE→7 all PRIVATE); `approvalStatus` narrows (UNINITIATED vs APPROVED→1); the two **combine** correctly. Unknown filter values return an empty list (not 400) — so we use Zod enums to guard client-side. Note: rich listing data truncates at `limit≈50` (~245KB) → use small limits or the spill file.

`app_version_listing_get` — one listing by buildNumber (chained). `create` (POST) / `update` (PUT) — destructive, static-verified only. Tests: 9. **App-version-listing reads COMPLETE; writes static.**

### Audit re-run #2 (2026-06-03) — 4 more tools completed from the findings list

The spec audit's remaining actionable gaps were probed live + fixed (findings dropped 18→11; the 11 left are pure `id[path]` naming noise + v1 promotions):

- **`privacy_security_get` — missing `state=live|draft`.** Response is `{commonCloud:{dataAccessAndStorage, logDetails, dataResidency, privacy, security, properties, hasRestAPIExtension, supportsConfigurableEgress}}`. `state=live` (default) = published; `state=draft` = unpublished draft (404 if none). Added the enum. Tests: 5 (new file). The 3 privacy writes remain static-only.
- **`parent_software_list` / `_versions_list` — missing cursor pagination.** Both are cursor-paginated (`limit`+`cursor` from `links.next`); the list's default page returns all ~23 products. Added `PS_PAGE`.

  Group finished (5/5): `parent_software_get` → `{id, developerId:'Atlassian', name, hostingOptions:[{hosting}], extensibilityFrameworks, state, revision}`; `version_by_build` (path `/versions/build/{buildNumber}`) + `version_by_number` (path `/versions/number/{versionNumber}`) both return `{buildNumber, versionNumber, hosting, state, revision, createdAt}` and **resolve to the identical version record** (verified). All by-ID lookups; no query params on the 3 single-item reads. Unknown id/build/version → 404 (surfaced). Paths were already correct (matched spec's `/build/` `/number/` segments). No bugs. Tests: 9 total (new file).
- **🐛 `partner_metrics_fetch` — misleading body guidance + missing `limit`/`offset`.** The old description implied `metrics` was a list of metric IDs, but the API's `ReportingMetricTimeSeriesRequestBody` needs `metrics` as an OBJECT (`{metricSets:[…objects], metricFields:[…objects]}`), `dateRange` as `{startDate,endDate}` (not start/end), `granularity` ∈ YEAR/MONTH/WEEK/DAY. A wrong shape → HTTP 400 with a JSON-parse message (surfaced, verified). Rewrote the description to the real schema and added the spec's `limit`/`offset` query params. Tests: 3 (new file — verifies schema + that a malformed body surfaces the 400).

### Cloud migration compatibility (`migrations.ts`)

`cloud_migration_compat_get` — flat `{developerId, productId, addonKey, addonName, cloudMigrationAssistantCompatibility, migrationPath, isDualLicenseOptedIn}`. Spec confirms NO query params (just `productId` path) — schema already complete, nothing to add. Key behavior: **returns HTTP 404 for apps with no migration-compat record** (only 4 of 11 apps in this space have one) — surfaced as an error, not a silent empty; documented. `compat_create` (PUT) / `compat_update` (PATCH) — destructive, static-verified only (never executed). Tests: 5. **Cloud-migration reads COMPLETE; writes static.**

**`accept=csv|json` on all 4 exports (was missing).** Cross-checked the params against the official OpenAPI spec (`swagger.marketplace.v3.txt`) — it confirms the list tools take ONLY date/aggregation/source (no category/text/etc. filter exists), AND that every export endpoint has an `accept=['csv','json']` query param we hadn't exposed. Verified live: `accept=csv` returns a header-rowed CSV string on all four (and the CSV layout is often flatter/more useful than the JSON — e.g. partner export CSV is per-app rows); invalid → HTTP 400. Added `SK_ACCEPT` to all 4 export schemas. Tests: 13. **Search-keywords group COMPLETE (8/8).**

### Block F completion (2026-07-16) — remaining groups audited tool-by-tool

Final sweep: every remaining group probed live (payload-level, not just status codes), schemas/docs corrected, real integration tests added. Full suite now **378 tests / 29 files**, green against the live API.

- **🐛 `artifact_fetch_from_url` was 100% non-functional.** The `/artifacts/fetch` body requires the field **`uri`**, but the tool sent **`url`** — every call failed with `400 VALIDATION_FAILED "Invalid value for field 'uri'"`. Fixed to map `url`→`uri`; verified live that requests now pass validation and reach the remote-fetch stage (`ARTIFACT_REMOTE_FETCH_FAILURE` on an unfetchable URL — proves the field is accepted without storing an artifact). Description updated with the real response shape `{fileInfo, _links, details}`. `artifact_get` clean (404 on unknown id). Two multipart uploads (`POST /artifacts`, `POST /assets/images/{imageType}`) deliberately unexposed. Tests: 5 (the unfetchable-URL probe doubles as a regression guard).

- **Developer space (`developer-space.ts`) — 9 tools (6 read, 3 member-mutation writes static).** `get` → `{id, vendorId, name, status, type, organisationId, version}`; `catalog_account` → `{developerId, catalogAccountId}`; `listings` → **bare array** (not an envelope). 🐛 **`members_list` uses a NON-STANDARD pagination shape** — `{members:[{aaid, roles, categories, email, userName}], next}` where `next` is a **BARE opaque cursor token** (not the `links.next` URL every other list tool returns); undocumented, so an LLM couldn't page it. Fixed the description + `cursor`/`limit` param docs; verified 28 members traverse completely across 10 pages at limit=3. Members are PII (email/userName) → tests assert structure only. Error codes vary (bad developerId/aaid→400, bad vendorId→404). `member_add`/`update`/`remove` (grant/revoke real console access) static-only. Tests: 10.

- **Reporting entrypoints — `product_catalog_latest` + `reporting_links`.** 🐛 **`product_catalog_latest` description was wrong.** It claimed "Atlassian products, editions, pricing tiers"; the presignedUrl actually serves a **~150 MB CSV** (Content-Type `binary/octet-stream`, NOT JSON) of the entire public Marketplace **app** catalog (`product_id, vendor_name, review_score, install_count, marketplace_app_key, app_software_hosting, …`). Verified by a ranged fetch of the header row (206 Partial Content); rewrote the description. Each call mints a fresh presigned URL (expires ~300s). `reporting_links` → HAL root `{_links}` with 26 reporting links (some are arrays of link-object variants — valid HAL); clean. Tests: 5.

- **App listing (`app-listing.ts`).** `app_listing_get` → full 20-field listing envelope (verified identical to an `apps_list` full-payload item — the two API endpoints return the same per-item shape). Enriched the thin description with the real shape + 404 behavior. **Investigated a suspected coverage gap** (`GET /product-listing/developer-space/{id}`), started an `app_listing_list` tool, then found `apps_list` already wraps that exact endpoint (byte-identical payload) → **reverted the duplicate**, added a regression test asserting no `app_listing_list` exists. `app_listing_update` (public marketplace impact) static-only. Tests: 5.

- **Promotions (`promotions.ts`, v1 API) — 10 tools (6 read, 4 writes static).** All 10 paths + the `list_paged` query params + the `create`/`update` body schemas match the v1 swagger exactly (`eligibleApps` input is `array<string>`; read response enriches to `{key,name}` objects — normal asymmetry). Three live gotchas documented: 🐛 an **unknown/mistyped `appKey` is silently ignored** (returns ALL promotions, not zero — a real key narrows 50→44, verified); **non-paged `promotions_list` hangs** to the 60s timeout on large partners (strengthened the warning; prefer `_list_paged`); **`promotions_get` on a bad id → HTTP 500** (not 404). A full `limit=50` page (~21 fields × 50) can exceed the 50k response cap and spill to a temp file. `status` returns bare `ACTIVE`; Cloud uses `nextId`/`prevId` cursors with `totalItems: null`. create/update/codes_create/code_delete (customer impact, no promotion-delete tool) static-only. Tests: 10.

- **Parent software hardening.** `version_by_build` build path segment now `encodeURIComponent`-escaped (raw interpolation would break on special chars). Pagination re-verified complete (23 products, 510+ Jira builds, no dups).

- **Reversible write success-path verification (privacy-security).** Beyond the static write checks, the privacy-security **draft** round-trip was verified end-to-end against the live API: `draft_put` → `get(state=draft)` → `draft_delete`, guarded against clobbering an existing draft, non-public (never `publish`), account restored to baseline. This confirms the success paths of two DESTRUCTIVE tools reversibly. The test suite remains intentionally **non-mutating**; all other writes are not safely reversible and stay static-only.

## Block totals so far

| Block | Tools audited | Integration tests |
|---|---|---|
| A — Discovery & reads | 8 | 17 |
| B — Licenses | 5 | 38 |
| C — Transactions | 7 | 30 |
| D — Sales metrics | 6 | 55 |
| D — Customer insights | 4 of 4 (regions, editions, tiers, active-users) | 27 |
| D — Feedback | 2 of 2 (details, metrics_by_metric) | 15 |
| D — Evaluations | 1 of 1 | 7 |
| D — Benchmarks | 2 of 2 | 8 |
| D — App requests | 1 of 1 | 5 |
| D — Marketing attribution | 3 of 3 | 6 |
| E — Reviews | 4 of 4 (2 read, 2 write static) | 16 |
| E — Search keywords | 8 of 8 | 13 |
| E — App-listing/software | 9 (6 read, 3 write static) | 11 |
| E — App-version-listing | 4 (2 read, 2 write static) | 9 |
| D — Free starter tier | 1 | 7 |
| F — Privacy & security | 1 of 4 (get; 3 write static) | 5 |
| F — Parent software | 5 of 5 (list, versions_list, get, by_build, by_number) | 9 |
| F — Partner metrics | 1 of 1 | 3 |
| F — Cloud migration | 3 (1 read, 2 write static) | 5 |
| F — Developer space | 9 (6 read, 3 write static) | 10 |
| F — Reporting entrypoints | 2 (product_catalog_latest, reporting_links) | 5 |
| F — App listing | 2 (1 read, 1 write static) | 5 |
| F — Artifacts | 2 (1 write-safe, 1 read) | 5 |
| F — Promotions (v1) | 10 (6 read, 4 write static) | 10 |
| Silent-ignore regression (metrics_churn) | — | 31 (1 sweep) |
| Unit tests (helpers, schemas) | — | 44 |

*(**Every tool group is now audited against the live API** (all 95 tools). All read paths exercised live; all 24 write tools verified against spec (static), and the privacy-security draft write path additionally verified end-to-end reversibly. Full suite: 378 tests / 29 files. Remaining known gap is intentional: write success-paths (except the reversible privacy-security draft) are not executed to keep the suite non-mutating.)*
