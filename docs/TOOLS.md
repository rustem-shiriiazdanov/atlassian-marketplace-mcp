# Catalog: tools, resources, prompts

Atlassian Marketplace MCP — **95 tools**, **3 resources**, **4 prompts**. Generated from live MCP responses on 2026-07-16.

Conventions:

- ⚠️ marks tools whose effects are publicly visible (customers, marketplace listing, other team members) or that create credentials. Mirrors `annotations.destructiveHint`.
- 🔧 marks tools that perform writes but aren't destructive (e.g. starting an async export).
- Other tools are read-only (`annotations.readOnlyHint: true`).
- 📖 **Spec** column links to Atlassian's official docs for each endpoint (v4 docs site labels the modern API as v4 even though the wire path is `/rest/3/...`; promotions are v1 — see [ARCHITECTURE.md](ARCHITECTURE.md)).
- All tools require the 4 base env vars (see [README](../README.md#configure)). Reporting tools also accept the shared filter set unless noted.
- `productId` is the **product UUID**, not the app key. Use `apps_list` / `apps_known`.
- Responses over ~50,000 chars are spilled to a tmp file; the tool result returns a summary + file pointer (`_file`).
- Sync exports and async-export downloads use a **10-minute** per-request timeout (overridable via env `EXPORT_TIMEOUT_MS`). Other calls use 60s.

## Table of contents

- [Resources](#resources)
- [Prompts](#prompts)
- Tools:
  - [Apps discovery](#apps-discovery) (2)
  - [Promotions](#promotions) (10)
  - [Licenses](#licenses) (5)
  - [Transactions](#transactions) (7)
  - [Reporting meta](#reporting-meta) (1)
  - [Evaluations](#evaluations) (1)
  - [Feedback](#feedback) (2)
  - [Customer insights](#customer-insights) (4)
  - [Sales metrics](#sales-metrics) (6)
  - [Benchmarks](#benchmarks) (2)
  - [Marketing attribution](#marketing-attribution) (3)
  - [App requests & approvals](#app-requests-approvals) (1)
  - [Reviews](#reviews) (4)
  - [Search keywords](#search-keywords) (6)
  - [Search keywords — zero results](#search-keywords-zero-results) (2)
  - [Free starter tier](#free-starter-tier) (1)
  - [App listing](#app-listing) (2)
  - [App software (versions, tokens)](#app-software-versions-tokens) (7)
  - [App version listing](#app-version-listing) (4)
  - [Privacy & security](#privacy-security) (4)
  - [Cloud migration compatibility](#cloud-migration-compatibility) (3)
  - [Parent software](#parent-software) (5)
  - [Developer space (admin)](#developer-space-admin) (9)
  - [Partner metrics](#partner-metrics) (1)
  - [Product catalog](#product-catalog) (1)
  - [Artifacts](#artifacts) (2)

## Resources

MCP Resources expose readable data without a tool call. Read them via `resources/read`.

| URI | Description |
|---|---|
| `apps://list` | All apps in this developer space (productId, appKey, appName, state). Live, 5-minute cached. |
| `apps://known` | Friendly-name → productId map loaded from PRODUCT_ID_* env vars. Static, no API call. |
| `vendor://profile` | Developer-space profile: developerId, partnerId, contact info, address. Pulled live. |

## Prompts

MCP Prompts are canonical workflows invokable via `prompts/get`.

### `monthly_kpi_summary`

Generate a monthly KPI summary across sales, churn, evaluations, and customer insights.

| Arg | Required | Description |
|---|---|---|
| `month` | yes | Month in YYYY-MM format, e.g. 2026-05 |
| `productId` | no | Optional product UUID to scope to one app |

### `draft_review_response`

Draft a professional vendor response to a Marketplace review.

| Arg | Required | Description |
|---|---|---|
| `productId` | yes | Product UUID |
| `reviewId` | yes | Review ID |
| `tone` | no | Tone of the response. Default: thankful for positive, apologetic for negative. |

### `customer_lookup`

Look up everything we know about a customer, given any identifier: SEN, Cloud appEntitlementNumber (E-...), appEntitlementId (UUID), cloudId, cloudSiteHostname, email, or organization name.

| Arg | Required | Description |
|---|---|---|
| `identifier` | yes | Any customer identifier. Accepts: SEN (Server/DC, format `SEN-L########`), Cloud appEntitlementNumber (format `E-XXX-XXX-XXX-XXX`), appEntitlementId (UUID), cloudId, cloudSiteHostname (`<site>.atlassian.net`), contact email, or organization name. |

### `promo_for_customer`

Create a single-use promo code for a specific customer with sensible defaults.

| Arg | Required | Description |
|---|---|---|
| `customerName` | yes | Customer organization name, used in the promo name |
| `appKey` | yes | App key (e.g. com.example.your-app) |
| `discountPercent` | yes | Discount percentage, e.g. '20' |
| `validForDays` | no | Promo validity from today in days. Default 30. |

## Apps discovery

### `apps_known`

**📖 Spec:** `GET /rest/3/product-listing/developer-space/{developerId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-developer-space-developerid-get)

> Local env map — closest related endpoint is apps_list

Return the static name -> productId map loaded from PRODUCT_ID_* env vars. Use this to look up product UUIDs by friendly name without an API call.

*(no args)*

### `apps_list`

**📖 Spec:** `GET /rest/3/product-listing/developer-space/{developerId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-developer-space-developerid-get)

Discover apps in this developer space (live API call). Returns productId (UUID — use as filter), appKey, appName, state. CURSOR-paginated: pass `cursor` (from a prior response's `nextCursor`) to page forward. In summary mode the result includes `nextCursor` (null when no more pages). Default (no `limit`) returns up to 10 (the API's default page size).

| Arg | Type | Required | Description |
|---|---|---|---|
| `includeFullPayload` | `boolean` | no | If true, return the raw API response ({items, links}). Default false returns a compact summary + nextCursor. |
| `limit` | `integer` | no | Page size. Omit for the API default (10). Cursor pagination — `offset` is not supported. |
| `cursor` | `string` | no | Opaque pagination token from a prior response's `nextCursor` (summary mode) or `links.next` (full mode). |
| `includePrivate` | `boolean` | no | Include private (unlisted) apps in addition to public ones. Invalid value → HTTP 400. |

## Promotions

### `promotions_code_delete` ⚠️ destructive

**📖 Spec:** `DELETE /catalog/partners/{partnerId}/promotions/{promotionId}/codes/{promotionCode}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-promotioncode-delete)

Delete an unused single-use code.

| Arg | Type | Required | Description |
|---|---|---|---|
| `promotionId` | `string` | yes |  |
| `promotionCode` | `string` | yes | Promotion code identifier (string like 'VN5U6M') |

### `promotions_code_get`

**📖 Spec:** `GET /catalog/partners/{partnerId}/promotions/{promotionId}/codes/{promotionCode}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-promotioncode-get)

Get one single-use code (including usage info if redeemed).

| Arg | Type | Required | Description |
|---|---|---|---|
| `promotionId` | `string` | yes |  |
| `promotionCode` | `string` | yes | Promotion code identifier (string like 'VN5U6M') |

### `promotions_codes_create` ⚠️ destructive

**📖 Spec:** `POST /catalog/partners/{partnerId}/promotions/{promotionId}/codes` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-post)

Generate a new single-use code for a promotion.

| Arg | Type | Required | Description |
|---|---|---|---|
| `promotionId` | `string` | yes |  |

### `promotions_codes_list`

**📖 Spec:** `GET /catalog/partners/{partnerId}/promotions/{promotionId}/codes` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-get)

List single-use codes for a SINGLE_USE_PROMOTION.

| Arg | Type | Required | Description |
|---|---|---|---|
| `promotionId` | `string` | yes |  |

### `promotions_create` ⚠️ destructive

**📖 Spec:** `POST /catalog/partners/{partnerId}/promotions` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-post)

Create a new promotion. PUBLIC IMPACT: promo code becomes redeemable by customers. Required: name, eligibleApps, expirationDate, hostingType, promotionType, discountType.

| Arg | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | yes |  |
| `eligibleApps` | `array` | yes | App keys this promotion applies to |
| `startDate` | `string` | no | ISO datetime (YYYY-MM-DDTHH:mm:ssZ). Plain YYYY-MM-DD is auto-padded with T00:00:00Z by this tool. |
| `expirationDate` | `string` | yes | ISO datetime (YYYY-MM-DDTHH:mm:ssZ). Plain YYYY-MM-DD is auto-padded with T00:00:00Z by this tool. |
| `promotionType` | `enum: SHARED_PROMOTION, SINGLE_USE_PROMOTION` | yes |  |
| `discountType` | `string` | yes |  |
| `discountPercent` | `integer` | no |  |
| `maxUses` | `integer` | no | Required for shared promotions unless allowUnlimitedUses=true |
| `hostingType` | `enum: SERVER, DATA_CENTER, CLOUD` | yes |  |
| `subscriptionType` | `enum: MONTHLY, ANNUAL` | no | Cloud only |
| `allowedBillingCycles` | `integer` | no | Cloud only |
| `allowUnlimitedUses` | `boolean` | no |  |
| `customPromoCode` | `string` | no | Cloud only; will be prefixed with autogen string for shared promos |

### `promotions_get`

**📖 Spec:** `GET /catalog/partners/{partnerId}/promotions/{promotionId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-get)

Get one promotion by ID. Returns the full promotion object (~21 fields: id, name, eligibleApps, startDate, expirationDate, status, promotionType, discountType, discountPercent, maxUses, used, hostingType, promotionCode, …). GOTCHA: a nonexistent/malformed promotionId returns HTTP 500 (not 404).

| Arg | Type | Required | Description |
|---|---|---|---|
| `promotionId` | `string` | yes | UUID for Cloud, string for Server/DC |

### `promotions_list`

**📖 Spec:** `GET /catalog/partners/{partnerId}/promotions` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-get)

> Deprecated non-paged variant; prefer promotions_list_paged

List ALL promotions in one non-paginated response (legacy). WARNING: on partners with many promotions this endpoint is very slow and can hit the request timeout (60s, then retried) — effectively hanging. Prefer promotions_list_paged in almost all cases; use this only when you truly need every promotion at once and know the set is small.

*(no args)*

### `promotions_list_paged`

**📖 Spec:** `GET /catalog/partners/{partnerId}/promotions/paged` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-paged-get)

List promotions (paginated). STRONGLY prefer this over promotions_list (the non-paged variant can time out). Returns `{_links, promotions:[…], offset, limit, totalItems, orderBy, nextId, prevId}`. Cloud uses cursor pagination via `nextId`/`prevId` (and `totalItems` is null); Server/DC uses `offset`/`limit`. Each promotion carries ~21 fields — a full page can exceed the response size cap and spill to a temp file, so page with a modest `limit`.

| Arg | Type | Required | Description |
|---|---|---|---|
| `limit` | `integer` | no | Page size for Server/DC (max 1500) |
| `offset` | `integer` | no | Skip N items for Server/DC pagination |
| `orderBy` | `enum: START_DATE, EXPIRATION_DATE, CREATION_DATE` | no |  |
| `activeOnly` | `boolean` | no |  |
| `hostingType` | `enum: SERVER, DATA_CENTER, CLOUD` | no |  |
| `appKey` | `string` | no | Filter to promotions eligible for this app key. GOTCHA: an unknown/mistyped app key is SILENTLY IGNORED by the API — it returns ALL promotions, not zero. Only a real, exact app key actually narrows... |
| `ascending` | `boolean` | no |  |
| `nextId` | `string` | no | Cloud-only forward page cursor |
| `prevId` | `string` | no | Cloud-only backward page cursor |

### `promotions_status`

**📖 Spec:** `GET /catalog/partners/{partnerId}/promotions/{promotionId}/status` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-status-get)

Get the status of a promotion (ACTIVE | ENDED_EARLY | EXPIRED).

| Arg | Type | Required | Description |
|---|---|---|---|
| `promotionId` | `string` | yes |  |

### `promotions_update` ⚠️ destructive

**📖 Spec:** `PATCH /catalog/partners/{partnerId}/promotions/{promotionId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-patch)

Update a promotion (PATCH — only supplied fields change).

| Arg | Type | Required | Description |
|---|---|---|---|
| `promotionId` | `string` | yes |  |
| `name` | `string` | no |  |
| `startDate` | `string` | no |  |
| `expirationDate` | `string` | no |  |
| `discountPercent` | `integer` | no |  |
| `maxUses` | `integer` | no |  |
| `allowedBillingCycles` | `integer` | no |  |

## Licenses

### `licenses_export_async_download`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/licenses/async/export/{exportId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-licenses-async-export-exportid-get)

Download a completed async license export. Returns the JSON array of license records. Request timeout is 10 min (overridable via EXPORT_TIMEOUT_MS env) so multi-MB downloads don't get aborted mid-stream. Only call this after the *_status endpoint reports DONE — otherwise you'll get a 404 'Export is being processed'.

| Arg | Type | Required | Description |
|---|---|---|---|
| `exportId` | `string` | yes |  |

### `licenses_export_async_start` 🔧 write-safe

**📖 Spec:** `POST /rest/3/reporting/developer-space/{developerId}/licenses/async/export` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-licenses-async-export-post)

Start an async license export job. Returns `{export:{id}}` to poll. `accept=csv|json` sets the format the eventual download will produce (the start response itself is always the id envelope).

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID (or comma-separated list). Use apps_list / apps_known to discover. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD |
| `endDate` | `string` | no | ISO date YYYY-MM-DD |
| `hosting` | `enum: cloud, datacenter, server` | no | Note: 'datacenter' is one word, not 'data_center'. Response objects use capitalized 'Cloud'/'Server'/'Data Center' but the filter param is lowercase one-word. |
| `offset` | `integer` | no |  |
| `limit` | `integer` | no |  |
| `sortBy` | `enum: addonName, company, country, endDate, hosting, licenseId, licenseType, partner, region, startDate, tier` | no |  |
| `order` | `enum: asc, desc` | no |  |
| `text` | `string` | no | Free-text search across identifiers: SEN, appEntitlementNumber (Cloud), appEntitlementId (UUID), cloudId, cloudSiteHostname, email, organization name. |
| `tier` | `integer` | no |  |
| `dateType` | `enum: start, end` | no |  |
| `licenseType` | `enum: academic, commercial, demonstration, evaluation, net_new_evaluation, upgrade_evaluation, open_source, starter, free, classroom, legacy_free` | no |  |
| `licenseLevel` | `enum: single-instance, multi-instance` | no |  |
| `partnerType` | `enum: direct, expert, reseller, upgrade` | no |  |
| `status` | `enum: active, inactive, cancelled` | no |  |
| `withAttribution` | `boolean` | no | DEPRECATED by Atlassian; use withDataInsights instead. Both add evaluation/attribution fields when true. |
| `withDataInsights` | `boolean` | no | Adds 10 extra fields to each license: evaluationOpportunitySize, evaluationLicense, daysToConvertEval, evaluationStartDate, evaluationEndDate, evaluationSaleDate, parentProductBillingCycle, parentP... |
| `includeAtlassianLicenses` | `boolean` | no | If true, include internal Atlassian licenses in the result. |
| `showLicensesHistory` | `boolean` | no | If true, returns the full history of license events for matched SENs (multiple rows per license). Not formally in the swagger but the runtime API accepts it. |
| `showLifeTimeFreeLicenses` | `boolean` | no | If true, scope the response to lifetime-free-tier licenses. If false (default), excludes them. |
| `cloudComplianceBoundaries` | `enum: commercial, fedramp_moderate, isolated_cloud` | no | Cloud compliance boundary. Valid values: 'commercial' (default), 'fedramp_moderate', 'isolated_cloud'. **Cloud-hosted apps only — silently ignored for server/datacenter apps.** Defaults to 'commerc... |
| `appEdition` | `enum: free, standard, advanced` | no | Filter by app edition (case-insensitive in practice but lowercase per Atlassian's error spec). |
| `lastUpdated` | `string` | no | ISO datetime — licenses updated on/after this instant. |
| `accept` | `enum: csv, json` | no | Output format: `csv` (default for these exports — header-rowed CSV string) or `json` (array of records). Invalid → HTTP 400. |

### `licenses_export_async_status`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/licenses/async/export/{exportId}/status` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-licenses-async-export-exportid-status-get)

Poll status of an async license export job.

| Arg | Type | Required | Description |
|---|---|---|---|
| `exportId` | `string` | yes |  |

### `licenses_export_sync`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/licenses/export` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-licenses-export-get)

Synchronous export of licenses. `accept=csv` (default) returns a CSV string; `accept=json` returns a JSON array. May 5xx on large ranges — prefer the async variant. Request timeout is bumped to 10 min (overridable via EXPORT_TIMEOUT_MS env).

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID (or comma-separated list). Use apps_list / apps_known to discover. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD |
| `endDate` | `string` | no | ISO date YYYY-MM-DD |
| `hosting` | `enum: cloud, datacenter, server` | no | Note: 'datacenter' is one word, not 'data_center'. Response objects use capitalized 'Cloud'/'Server'/'Data Center' but the filter param is lowercase one-word. |
| `offset` | `integer` | no |  |
| `limit` | `integer` | no |  |
| `sortBy` | `enum: addonName, company, country, endDate, hosting, licenseId, licenseType, partner, region, startDate, tier` | no |  |
| `order` | `enum: asc, desc` | no |  |
| `text` | `string` | no | Free-text search across identifiers: SEN, appEntitlementNumber (Cloud), appEntitlementId (UUID), cloudId, cloudSiteHostname, email, organization name. |
| `tier` | `integer` | no |  |
| `dateType` | `enum: start, end` | no |  |
| `licenseType` | `enum: academic, commercial, demonstration, evaluation, net_new_evaluation, upgrade_evaluation, open_source, starter, free, classroom, legacy_free` | no |  |
| `licenseLevel` | `enum: single-instance, multi-instance` | no |  |
| `partnerType` | `enum: direct, expert, reseller, upgrade` | no |  |
| `status` | `enum: active, inactive, cancelled` | no |  |
| `withAttribution` | `boolean` | no | DEPRECATED by Atlassian; use withDataInsights instead. Both add evaluation/attribution fields when true. |
| `withDataInsights` | `boolean` | no | Adds 10 extra fields to each license: evaluationOpportunitySize, evaluationLicense, daysToConvertEval, evaluationStartDate, evaluationEndDate, evaluationSaleDate, parentProductBillingCycle, parentP... |
| `includeAtlassianLicenses` | `boolean` | no | If true, include internal Atlassian licenses in the result. |
| `showLicensesHistory` | `boolean` | no | If true, returns the full history of license events for matched SENs (multiple rows per license). Not formally in the swagger but the runtime API accepts it. |
| `showLifeTimeFreeLicenses` | `boolean` | no | If true, scope the response to lifetime-free-tier licenses. If false (default), excludes them. |
| `cloudComplianceBoundaries` | `enum: commercial, fedramp_moderate, isolated_cloud` | no | Cloud compliance boundary. Valid values: 'commercial' (default), 'fedramp_moderate', 'isolated_cloud'. **Cloud-hosted apps only — silently ignored for server/datacenter apps.** Defaults to 'commerc... |
| `appEdition` | `enum: free, standard, advanced` | no | Filter by app edition (case-insensitive in practice but lowercase per Atlassian's error spec). |
| `lastUpdated` | `string` | no | ISO datetime — licenses updated on/after this instant. |
| `accept` | `enum: csv, json` | no | Output format: `csv` (default for these exports — header-rowed CSV string) or `json` (array of records). Invalid → HTTP 400. |

### `licenses_list`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/licenses` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-licenses-get)

List licenses for the developer space (paginated, offset/limit). Use 'text' to find a single license by SEN.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID (or comma-separated list). Use apps_list / apps_known to discover. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD |
| `endDate` | `string` | no | ISO date YYYY-MM-DD |
| `hosting` | `enum: cloud, datacenter, server` | no | Note: 'datacenter' is one word, not 'data_center'. Response objects use capitalized 'Cloud'/'Server'/'Data Center' but the filter param is lowercase one-word. |
| `offset` | `integer` | no |  |
| `limit` | `integer` | no |  |
| `sortBy` | `enum: addonName, company, country, endDate, hosting, licenseId, licenseType, partner, region, startDate, tier` | no |  |
| `order` | `enum: asc, desc` | no |  |
| `text` | `string` | no | Free-text search across identifiers: SEN, appEntitlementNumber (Cloud), appEntitlementId (UUID), cloudId, cloudSiteHostname, email, organization name. |
| `tier` | `integer` | no |  |
| `dateType` | `enum: start, end` | no |  |
| `licenseType` | `enum: academic, commercial, demonstration, evaluation, net_new_evaluation, upgrade_evaluation, open_source, starter, free, classroom, legacy_free` | no |  |
| `licenseLevel` | `enum: single-instance, multi-instance` | no |  |
| `partnerType` | `enum: direct, expert, reseller, upgrade` | no |  |
| `status` | `enum: active, inactive, cancelled` | no |  |
| `withAttribution` | `boolean` | no | DEPRECATED by Atlassian; use withDataInsights instead. Both add evaluation/attribution fields when true. |
| `withDataInsights` | `boolean` | no | Adds 10 extra fields to each license: evaluationOpportunitySize, evaluationLicense, daysToConvertEval, evaluationStartDate, evaluationEndDate, evaluationSaleDate, parentProductBillingCycle, parentP... |
| `includeAtlassianLicenses` | `boolean` | no | If true, include internal Atlassian licenses in the result. |
| `showLicensesHistory` | `boolean` | no | If true, returns the full history of license events for matched SENs (multiple rows per license). Not formally in the swagger but the runtime API accepts it. |
| `showLifeTimeFreeLicenses` | `boolean` | no | If true, scope the response to lifetime-free-tier licenses. If false (default), excludes them. |
| `cloudComplianceBoundaries` | `enum: commercial, fedramp_moderate, isolated_cloud` | no | Cloud compliance boundary. Valid values: 'commercial' (default), 'fedramp_moderate', 'isolated_cloud'. **Cloud-hosted apps only — silently ignored for server/datacenter apps.** Defaults to 'commerc... |
| `appEdition` | `enum: free, standard, advanced` | no | Filter by app edition (case-insensitive in practice but lowercase per Atlassian's error spec). |
| `lastUpdated` | `string` | no | ISO datetime — licenses updated on/after this instant. |

## Transactions

### `transactions_aggregate_by_hosting`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/transactions/{metric}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-metric-get)

> Friendly alias of transactions_aggregate_by_metric(metric='hosting')

Friendly alias for transactions_aggregate_by_metric(metric='hosting'). HAL template `hosting{?aggregation,startDate,endDate}`. NOTE: `productId` is silently ignored on this specific endpoint (verified 2026-06-03) — use `transactions_aggregate_by_metric` with `metric=hosting` if you need productId scoping.

📖 Spec (GET /rest/3/reporting/developer-space/{developerId}/sales/transactions/{metric} — Friendly alias of transactions_aggregate_by_metric(metric='hosting')): https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-metric-get

| Arg | Type | Required | Description |
|---|---|---|---|
| `aggregation` | `enum: month, week` | no | Time bucket granularity for the series — month or week. |
| `startDate` | `string` | no |  |
| `endDate` | `string` | no |  |

### `transactions_aggregate_by_metric`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/transactions/{metric}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-metric-get)

Aggregated sales grouped by a metric path segment. Maps to /sales/transactions/{metric}.

| Arg | Type | Required | Description |
|---|---|---|---|
| `metric` | `enum: country, hosting, partner, region, tier, type` | yes | Allowable values per Atlassian: country, hosting, partner, region, tier, type |
| `aggregation` | `enum: month, week` | no | Time bucket granularity for the series — month or week. |
| `productId` | `string` | no | Optional product UUID. Not documented in swagger but accepted by the live API and applied. |
| `startDate` | `string` | no |  |
| `endDate` | `string` | no |  |
| `hosting` | `enum: cloud, datacenter, server` | no |  |

### `transactions_export_async_download`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/transactions/async/export/{exportId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-async-export-exportid-get)

Download a completed async transactions export. Returns the JSON array of transaction records. Request timeout is 10 min (overridable via EXPORT_TIMEOUT_MS env). Only call this after the *_status endpoint reports DONE — otherwise you'll get a 404 'Export is being processed'.

| Arg | Type | Required | Description |
|---|---|---|---|
| `exportId` | `string` | yes |  |

### `transactions_export_async_start` 🔧 write-safe

**📖 Spec:** `POST /rest/3/reporting/developer-space/{developerId}/sales/transactions/async/export` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-async-export-post)

Start an async transactions export job. Returns `{export:{id}}` to poll. `accept=csv|json` sets the eventual download format (start response is always the id envelope).

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID (or comma-separated list). Use apps_list / apps_known to discover. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD |
| `endDate` | `string` | no | ISO date YYYY-MM-DD |
| `hosting` | `enum: cloud, datacenter, server` | no | Note: 'datacenter' is one word, not 'data_center'. Response objects use capitalized 'Cloud'/'Server'/'Data Center' but the filter param is lowercase one-word. |
| `offset` | `integer` | no |  |
| `limit` | `integer` | no |  |
| `sortBy` | `enum: addonName, company, country, date, hosting, licenseId, licenseType, partner, partnerType, purchasePrice, region, saleType, tier, transactionId, vendorAmount, paymentStatus` | no |  |
| `order` | `enum: asc, desc` | no |  |
| `text` | `string` | no | Free-text search across identifiers: transactionId, licenseId, SEN, appEntitlementNumber, customer info, partner info. |
| `tier` | `integer` | no |  |
| `saleType` | `enum: new, refund, downgrade, renewal, upgrade` | no |  |
| `partnerType` | `enum: direct, expert, reseller, upgrade` | no |  |
| `billingPeriod` | `enum: monthly, annual` | no | Filter by billing period. Not documented in swagger but accepted by the live API. |
| `lastUpdated` | `string` | no | ISO date/datetime — returns transactions updated ON OR AFTER this date (inclusive lower bound). |
| `excludeZeroTransactions` | `boolean` | no | If true, omits $0 transactions (e.g. Cloud Free tier). |
| `includeManualInvoice` | `boolean` | no | If true, includes manually-invoiced transactions in the response. |
| `paymentStatus` | `enum: paid, refunded, uncollectible, open` | no |  |
| `cloudComplianceBoundaries` | `enum: commercial, fedramp_moderate, isolated_cloud` | no | Cloud compliance boundary on the underlying license. Valid: 'commercial' (default), 'fedramp_moderate', 'isolated_cloud'. **Cloud-hosted apps only — ignored for server/datacenter.** Single value he... |
| `appEdition` | `enum: free, standard, advanced` | no | Filter by app edition (free / standard / advanced). |
| `accept` | `enum: csv, json` | no | Output format: `csv` (default for these exports — header-rowed CSV string) or `json` (array of records). Invalid → HTTP 400. |

### `transactions_export_async_status`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/transactions/async/export/{exportId}/status` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-async-export-exportid-status-get)

Poll status of an async transactions export job.

| Arg | Type | Required | Description |
|---|---|---|---|
| `exportId` | `string` | yes |  |

### `transactions_export_sync`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/transactions/export` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-export-get)

Synchronous export of transactions. `accept=csv` (default) returns a CSV string; `accept=json` returns a JSON array. Prefer async for large ranges. Request timeout is 10 min (overridable via EXPORT_TIMEOUT_MS env).

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID (or comma-separated list). Use apps_list / apps_known to discover. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD |
| `endDate` | `string` | no | ISO date YYYY-MM-DD |
| `hosting` | `enum: cloud, datacenter, server` | no | Note: 'datacenter' is one word, not 'data_center'. Response objects use capitalized 'Cloud'/'Server'/'Data Center' but the filter param is lowercase one-word. |
| `offset` | `integer` | no |  |
| `limit` | `integer` | no |  |
| `sortBy` | `enum: addonName, company, country, date, hosting, licenseId, licenseType, partner, partnerType, purchasePrice, region, saleType, tier, transactionId, vendorAmount, paymentStatus` | no |  |
| `order` | `enum: asc, desc` | no |  |
| `text` | `string` | no | Free-text search across identifiers: transactionId, licenseId, SEN, appEntitlementNumber, customer info, partner info. |
| `tier` | `integer` | no |  |
| `saleType` | `enum: new, refund, downgrade, renewal, upgrade` | no |  |
| `partnerType` | `enum: direct, expert, reseller, upgrade` | no |  |
| `billingPeriod` | `enum: monthly, annual` | no | Filter by billing period. Not documented in swagger but accepted by the live API. |
| `lastUpdated` | `string` | no | ISO date/datetime — returns transactions updated ON OR AFTER this date (inclusive lower bound). |
| `excludeZeroTransactions` | `boolean` | no | If true, omits $0 transactions (e.g. Cloud Free tier). |
| `includeManualInvoice` | `boolean` | no | If true, includes manually-invoiced transactions in the response. |
| `paymentStatus` | `enum: paid, refunded, uncollectible, open` | no |  |
| `cloudComplianceBoundaries` | `enum: commercial, fedramp_moderate, isolated_cloud` | no | Cloud compliance boundary on the underlying license. Valid: 'commercial' (default), 'fedramp_moderate', 'isolated_cloud'. **Cloud-hosted apps only — ignored for server/datacenter.** Single value he... |
| `appEdition` | `enum: free, standard, advanced` | no | Filter by app edition (free / standard / advanced). |
| `accept` | `enum: csv, json` | no | Output format: `csv` (default for these exports — header-rowed CSV string) or `json` (array of records). Invalid → HTTP 400. |

### `transactions_list`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/transactions` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-get)

List sales transactions for this vendor's apps (refunds appear inline as negative amounts). NOTE per Atlassian: this endpoint can return 5xx on large datasets — for full pulls, prefer transactions_export_async_start + status + download. Use 'text' to find by transactionId, licenseId, SEN, customer info, or partner info.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID (or comma-separated list). Use apps_list / apps_known to discover. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD |
| `endDate` | `string` | no | ISO date YYYY-MM-DD |
| `hosting` | `enum: cloud, datacenter, server` | no | Note: 'datacenter' is one word, not 'data_center'. Response objects use capitalized 'Cloud'/'Server'/'Data Center' but the filter param is lowercase one-word. |
| `offset` | `integer` | no |  |
| `limit` | `integer` | no |  |
| `sortBy` | `enum: addonName, company, country, date, hosting, licenseId, licenseType, partner, partnerType, purchasePrice, region, saleType, tier, transactionId, vendorAmount, paymentStatus` | no |  |
| `order` | `enum: asc, desc` | no |  |
| `text` | `string` | no | Free-text search across identifiers: transactionId, licenseId, SEN, appEntitlementNumber, customer info, partner info. |
| `tier` | `integer` | no |  |
| `saleType` | `enum: new, refund, downgrade, renewal, upgrade` | no |  |
| `partnerType` | `enum: direct, expert, reseller, upgrade` | no |  |
| `billingPeriod` | `enum: monthly, annual` | no | Filter by billing period. Not documented in swagger but accepted by the live API. |
| `lastUpdated` | `string` | no | ISO date/datetime — returns transactions updated ON OR AFTER this date (inclusive lower bound). |
| `excludeZeroTransactions` | `boolean` | no | If true, omits $0 transactions (e.g. Cloud Free tier). |
| `includeManualInvoice` | `boolean` | no | If true, includes manually-invoiced transactions in the response. |
| `paymentStatus` | `enum: paid, refunded, uncollectible, open` | no |  |
| `cloudComplianceBoundaries` | `enum: commercial, fedramp_moderate, isolated_cloud` | no | Cloud compliance boundary on the underlying license. Valid: 'commercial' (default), 'fedramp_moderate', 'isolated_cloud'. **Cloud-hosted apps only — ignored for server/datacenter.** Single value he... |
| `appEdition` | `enum: free, standard, advanced` | no | Filter by app edition (free / standard / advanced). |

## Reporting meta

### `reporting_links`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-get)

Get the reporting root — a HAL response that lists all available reporting links for this developer space.

*(no args)*

## Evaluations

### `evaluations_by_metric`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/evaluations/{metric}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-evaluations-metric-get)

Evaluation time-series grouped by a dimension. FLAT `total.series[]` (no datasets, no uniqueTotal) — one series per group value (e.g. country names for `metric=country`), each `{name, elements:[{date,count}]}` — plus per-app `addons[]`. Only aggregation/startDate/endDate filter (productId/hosting/addon are silently ignored on this endpoint).

| Arg | Type | Required | Description |
|---|---|---|---|
| `metric` | `enum: country, hosting, partner, region` | yes | Path segment / grouping dimension. Allowable per Atlassian: `country`, `hosting`, `partner`, `region`. Anything else → HTTP 400. |
| `aggregation` | `enum: week, month` | no | Time-series bucket cadence. Default week. Invalid → 400. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

## Feedback

### `feedback_details`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/feedback/details` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-feedback-details-get)

Raw customer feedback entries (uninstall/disable/unsubscribe events with reasons + free-text messages). Returns `{_links:{self,query,next}, feedback:[{addonKey, addonVersion, applicationKey, applicationVersion, hosting, date, feedbackType, reasonKey, reason, message, fullName, appEntitlementId, appEntitlementNumber, productId}]}`. `_links.next` paginates. Filter by type/reason/hosting/addon/productId/anonymous/text + date range. NOTE: contains customer PII (names, free-text comments).

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID. Narrows to one app. (Not in the HAL template but works.) Prefer this or `addon`, not both. |
| `addon` | `string` | no | App key (e.g. `com.example.your-app`). Narrows to one app. Alternative to `productId`. |
| `type` | `enum: uninstall, disable, unsubscribe` | no | Feedback event type (maps to response `feedbackType`). Strict enum — invalid → HTTP 400. |
| `reason` | `string` | no | Filter by `reasonKey`. Observed values: bugs, merging, not-meeting-needs, other, project-based, sandbox, usefulness. |
| `hosting` | `enum: cloud, datacenter, server` | no | Filter by hosting. Response uses 'Cloud'/'Server'/'Data Center'. |
| `appEdition` | `enum: free, standard, advanced` | no | Filter by app edition (free/standard/advanced) — documented in the spec + verified to narrow (2026-06-03). |
| `anonymous` | `boolean` | no | `true` returns only anonymized feedback (empty `fullName`); `false` only attributed. Invalid value → 400. |
| `text` | `string` | no | Free-text search across the feedback message and identifiers. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD (filters by feedback date). |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |
| `offset` | `integer` | no |  |
| `limit` | `integer` | no | Max 50 (server cap). `_links.next` carries the next page. |

### `feedback_metrics_by_metric`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/feedback/metrics/{metric}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-feedback-metrics-metric-get)

Feedback time-series grouped by a metric. FLAT `total.series[]` (no datasets, no uniqueTotal) — one series per group value, each `{name, elements:[{date,count}]}` — plus per-app `addons[]`. For `metric=reason` series are reasonKeys (bugs, merging, not-meeting-needs, other, project-based, sandbox, usefulness); for `metric=type` series are feedbackTypes (disable, uninstall, unsubscribe). Only aggregation/startDate/endDate filter (productId/hosting/addon are ignored).

| Arg | Type | Required | Description |
|---|---|---|---|
| `metric` | `enum: reason, type` | yes | Path segment. Allowable per Atlassian: `reason` or `type`. Anything else → HTTP 400. |
| `aggregation` | `enum: week, month` | no | Time-series bucket cadence. Default week. Invalid → 400. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

## Customer insights

### `customer_insights_active_users`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/customer-insights/active-users` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-active-users-get)

Paid-vs-non-paid active-user distribution across the customer base, per month. Group key `activeUsers` ∈ {paid, non-paid} (2 buckets, `usersPercent` sums to ~100). Each `usersDistribution:{usersCount, usersPercent, usersMarketplaceBenchmark}`. Only startDate/endDate filter (productId/hosting/product are ignored).

| Arg | Type | Required | Description |
|---|---|---|---|
| `startDate` | `string` | no | ISO date YYYY-MM-DD. Filters the monthly distribution buckets. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

### `customer_insights_editions`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/customer-insights/editions` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-editions-get)

App-edition distribution of your customers' users, per month. Same shape as `customer_insights_regions` but grouped by `edition` ∈ {free, standard, premium, enterprise}. Each `{date, insightsType:[{value:{group:{edition}, usersDistribution:{usersCount, usersPercent, usersMarketplaceBenchmark}}}]}`. Only startDate/endDate filter (productId/hosting/product are ignored by this endpoint).

| Arg | Type | Required | Description |
|---|---|---|---|
| `startDate` | `string` | no | ISO date YYYY-MM-DD. Filters the monthly distribution buckets. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

### `customer_insights_regions`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/customer-insights/regions` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-regions-get)

Geographic-region distribution of your customers' users, per month. Returns `usersDistributionPerMonth[]`: each `{date, insightsType:[{value:{group:{region}, usersDistribution:{usersCount, usersPercent, usersMarketplaceBenchmark}}}]}`. Regions seen: apac, emea, americas, unknown. `usersPercent` sums to ~100 per month; `usersMarketplaceBenchmark` is the ecosystem comparison. Only startDate/endDate filter (productId/hosting are ignored by this endpoint).

| Arg | Type | Required | Description |
|---|---|---|---|
| `startDate` | `string` | no | ISO date YYYY-MM-DD. Filters the monthly distribution buckets. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

### `customer_insights_tiers`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/customer-insights/tiers` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-tiers-get)

User-tier distribution of your customers, per month, split by HOST PRODUCT. Group has TWO keys: `{product, tier}` where `product` is the host app (Jira/Confluence/…) and `tier` ∈ {Evaluation, 1-10, 11-100, 101-1000, 1000+}. Each `usersDistribution:{usersCount, usersPercent, usersMarketplaceBenchmark}`. `usersPercent` sums to ~100% PER host product (so ~200% across two products). Filter to one host with `product=Jira` (NAME, case-insensitive — not a UUID). startDate/endDate also filter; productId/hosting are ignored.

| Arg | Type | Required | Description |
|---|---|---|---|
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |
| `product` | `string` | no | Host application NAME — `jira` or `confluence` (case-insensitive). NOT a productId UUID or app key — anything else returns HTTP 400 'Must be a jira or confluence'. Omit to get all host products. |

## Sales metrics

### `metrics_churn`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/metrics/churn` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-churn-get)

Cloud churn TIME-SERIES (not a single rate). Returns `total.datasets` split by billing period (`Monthly`, `Annual`) with two series each: `Customers` (cohort denominator) and `Cancellations` (numerator), plus per-app breakdown in `addons[]`. Caller computes rate = Cancellations / Customers per bucket. Only 3 filters work (aggregation/startDate/endDate); productId/hosting/addon are silently ignored on this aggregate endpoint.

| Arg | Type | Required | Description |
|---|---|---|---|
| `aggregation` | `enum: week, month` | no | Time-series bucket cadence. Default: week. Affects the number of `elements[]` returned per series. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD (inclusive lower bound). |
| `endDate` | `string` | no | ISO date YYYY-MM-DD (inclusive upper bound). |

### `metrics_churn_benchmark`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/metrics/churn/benchmark` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-churn-benchmark-get)

Per-app monthly churn benchmark vs. ecosystem average. Returns `churnBenchmarkPerApp[]` where each entry has `churnBenchmarkPerMonth[]` rows: `{year, month, churnedLicenses, totalLicenses, churnRate, isolatedChurnRate, churnRateBenchmark, isolatedChurnRateBenchmark}`. The `*Benchmark` fields are normalized so 1.0 ≈ ecosystem average. Filter by `addon` (app key) or `productId` (UUID). Note: data has a ~2-3 month publication lag. Default (no filter) returns full history for all apps — large response (~60KB) triggers the truncation envelope. Use date range to narrow.

| Arg | Type | Required | Description |
|---|---|---|---|
| `addon` | `string` | no | App key (e.g. `com.example.your-app` — NOT productId UUID). Single value via this MCP. Silently ignored if `productId` is also passed. |
| `productId` | `string` | no | Product UUID. Single value. Not documented in Atlassian's HAL query template but works as a real filter. When BOTH `addon` and `productId` are passed, `productId` wins. Invalid or non-matching UUID... |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. Trims `churnBenchmarkPerMonth[]` to months overlapping the window. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. Note: data has a ~2-3 month publication lag; very recent windows can return empty `churnBenchmarkPerApp[]`. |

### `metrics_conversion`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/metrics/conversion` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-conversion-get)

Cloud evaluation→paid conversion TIME-SERIES. Shape differs from churn/renewal: `total.series[]` is FLAT (no `datasets[]` billing-period split) with two series — `Evaluations` (denominator) and `Conversions` (numerator) — each a list of `{date, count}` elements. No `uniqueTotal` field. `addons[]` carry `series` directly. Caller computes conversion rate = Conversions / Evaluations per bucket. Only aggregation/startDate/endDate work; other filters silently ignored. Reversed or future-only ranges return empty `series`/`addons`.

| Arg | Type | Required | Description |
|---|---|---|---|
| `aggregation` | `enum: week, month` | no | Time-series bucket cadence. Default: week. Affects the number of `elements[]` returned per series. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD (inclusive lower bound). |
| `endDate` | `string` | no | ISO date YYYY-MM-DD (inclusive upper bound). |

### `metrics_details_by_metric`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/metrics/{saleMetric}/details` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-salemetric-details-get)

License-event details underlying a sale metric. Returns `events[]` rows: `{addonKey, addonName, hosting, lastUpdated, eventDate, transactionId, licenseDetails, productId}`. Supports rich filters (addon, hosting, partnerType, text, sortBy, order, offset, limit). Server caps limit at 50.

| Arg | Type | Required | Description |
|---|---|---|---|
| `saleMetric` | `enum: churn, conversion, renewal` | yes | Which underlying metric's events to fetch. |
| `productId` | `string` | no | Product UUID — narrows events to one app (documented + verified 2026-06-03; all returned rows match). |
| `appEdition` | `enum: free, standard, advanced` | no | Filter by app edition (free/standard/advanced). |
| `addon` | `string` | no | App key (e.g. `com.example.your-app`). Undocumented but works as an app filter. Prefer `productId`. |
| `hosting` | `enum: cloud, datacenter, server` | no | Filter events by hosting. Response objects use capitalized 'Cloud'/'Server'/'Data Center'. |
| `partnerType` | `enum: direct, expert, reseller` | no | Filter by partner attribution channel: `direct`, `expert`, `reseller`. NOTE: Atlassian's error message also lists `upgrade` as allowable, but passing it returns HTTP 400 (Atlassian-side contradicti... |
| `text` | `string` | no | Free-text search across event identifiers (SEN / appEntitlementNumber, transactionId, customer email, etc). Verified to narrow correctly. |
| `lastUpdated` | `string` | no | ISO date YYYY-MM-DD — events whose lastUpdated is on/after this date. Verified to narrow correctly. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD (filters by eventDate). |
| `endDate` | `string` | no | ISO date YYYY-MM-DD (filters by eventDate). |
| `sortBy` | `enum: addonName, date, hosting, transactionId, licenseId` | no | Sort field. Allowed per Atlassian: `addonName`, `date`, `hosting`, `transactionId`, `licenseId`. Anything else → HTTP 400. Only meaningful combined with `order=asc` (see `order`). |
| `order` | `enum: asc, desc` | no | Sort direction. **`asc` works; `desc` is unreliable on this endpoint** — Atlassian returns a non-monotonic ordering for `order=desc` (verified 2026-06-03). With no `sortBy`, `order` is ignored enti... |
| `offset` | `integer` | no |  |
| `limit` | `integer` | no | Max 50 (server hard-cap; values above are clamped to 50). |

### `metrics_details_export`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/metrics/{saleMetric}/details/export` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-salemetric-details-export-get)

Export of license-event details for a sale metric. `accept=csv` (default) returns the 17-column CSV (`addonName,addonKey,hosting,lastUpdated,eventDate,transactionId,licenseId,maintenanceStartDate,maintenanceEndDate,monthsValid,appEntitlementId,appEntitlementNumber,cloudId,inGracePeriod,multiInstanceEntitlementId,multiInstanceEntitlementNumber,appEdition`); `accept=json` returns a JSON array. Same filters as `metrics_details_by_metric` EXCEPT no `offset`/`limit` (full dump). 10-minute timeout (override via EXPORT_TIMEOUT_MS). Large exports spill to a tmp file via the truncation envelope.

| Arg | Type | Required | Description |
|---|---|---|---|
| `saleMetric` | `enum: churn, conversion, renewal` | yes | Which underlying metric's events to export. |
| `productId` | `string` | no | Product UUID — narrows events to one app (documented + verified 2026-06-03; all returned rows match). |
| `appEdition` | `enum: free, standard, advanced` | no | Filter by app edition (free/standard/advanced). |
| `addon` | `string` | no | App key (e.g. `com.example.your-app`). Undocumented but works as an app filter. Prefer `productId`. |
| `hosting` | `enum: cloud, datacenter, server` | no | Filter events by hosting. Response objects use capitalized 'Cloud'/'Server'/'Data Center'. |
| `partnerType` | `enum: direct, expert, reseller` | no | Filter by partner attribution channel: `direct`, `expert`, `reseller`. NOTE: Atlassian's error message also lists `upgrade` as allowable, but passing it returns HTTP 400 (Atlassian-side contradicti... |
| `text` | `string` | no | Free-text search across event identifiers (SEN / appEntitlementNumber, transactionId, customer email, etc). Verified to narrow correctly. |
| `lastUpdated` | `string` | no | ISO date YYYY-MM-DD — events whose lastUpdated is on/after this date. Verified to narrow correctly. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD (filters by eventDate). |
| `endDate` | `string` | no | ISO date YYYY-MM-DD (filters by eventDate). |
| `sortBy` | `enum: addonName, date, hosting, transactionId, licenseId` | no | Sort field. Allowed per Atlassian: `addonName`, `date`, `hosting`, `transactionId`, `licenseId`. Anything else → HTTP 400. Only meaningful combined with `order=asc` (see `order`). |
| `order` | `enum: asc, desc` | no | Sort direction. **`asc` works; `desc` is unreliable on this endpoint** — Atlassian returns a non-monotonic ordering for `order=desc` (verified 2026-06-03). With no `sortBy`, `order` is ignored enti... |
| `accept` | `enum: csv, json` | no | Output format: `csv` (default for these exports — header-rowed CSV string) or `json` (array of records). Invalid → HTTP 400. |

### `metrics_renewal`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/metrics/renewal` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-renewal-get)

Cloud renewal TIME-SERIES. `total.datasets[]` split by billing period (`Annual`, `Monthly`) — like churn — with two series each: `Renewal opportunities` (denominator) and `Renewals` (numerator). NOTE: unlike churn, renewal series have NO `uniqueTotal` field (each series is just `{name, elements:[{date,count}]}`). `addons[]` carry `datasets`. Caller computes renewal rate = Renewals / Renewal opportunities per bucket. Only aggregation/startDate/endDate work; other filters silently ignored. Reversed/future ranges return empty datasets+addons.

| Arg | Type | Required | Description |
|---|---|---|---|
| `aggregation` | `enum: week, month` | no | Time-series bucket cadence. Default: week. Affects the number of `elements[]` returned per series. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD (inclusive lower bound). |
| `endDate` | `string` | no | ISO date YYYY-MM-DD (inclusive upper bound). |

## Benchmarks

### `benchmark_evaluations`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/benchmark/evaluations` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-benchmark-evaluations-get)

Evaluations benchmark vs. ecosystem, per month. Returns `{totals:{name, evaluationBenchmarkPerVendorPerMonth:[…]}, addons:[{addonKey, name, productId, evaluationBenchmarkPerAppPerMonth}]}`. NOTE the wrapper is `totals` (plural) and the per-month key differs between total level (`…PerVendorPerMonth`) and addon level (`…PerAppPerMonth`). Each month row: `{date, evaluationCount, previousMonthEvaluationCount, evaluationMoMGrowth, evaluationPercentile, evaluationMoMGrowthBenchmarkAllPartners, evaluationCountYTD, evaluationCountYTDLastYear, evaluationYTDYoYGrowth, evaluationYTDPercentile, evaluationYTDYoYGrowthBenchmarkAllPartners}`. Filter by addon/productId; hosting/aggregation ignored.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID. Narrows to one app. (Not in the HAL template but works.) |
| `addon` | `string` | no | App key (e.g. `com.example.your-app`). Narrows to one app. Alternative to `productId`. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

### `benchmark_sales`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/benchmark/sales` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-benchmark-sales-get)

Sales benchmark vs. ecosystem, per month. Returns `{total:{name, salesBenchmarkPerMonth:[…]}, addons:[{addonKey, name, productId, salesBenchmarkPerMonth}]}`. Each month row: `{date, sale, previousMonthSale, salesMoMGrowth, salesPercentile, salesMoMGrowthBenchmarkAllPartners, salesYTD, salesYTDLastYear, salesYTDYoYGrowth, salesYTDPercentile, salesYTDYoYGrowthBenchmarkAllPartners}`. `*Percentile` is your rank vs all partners; `*BenchmarkAllPartners` is the ecosystem figure. Filter by addon (app key) or productId; hosting/aggregation are ignored.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID. Narrows to one app. (Not in the HAL template but works.) |
| `addon` | `string` | no | App key (e.g. `com.example.your-app`). Narrows to one app. Alternative to `productId`. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

## Marketing attribution

### `marketing_attribution_export_async_download`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/async/export/{exportId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-async-export-exportid-get)

Download a completed async marketing-attribution export. Returns JSON records. Request timeout is 10 min (overridable via EXPORT_TIMEOUT_MS env). Only call this after the *_status endpoint reports DONE — otherwise you'll get a 404 'Export is being processed'.

| Arg | Type | Required | Description |
|---|---|---|---|
| `exportId` | `string` | yes |  |

### `marketing_attribution_export_async_start` 🔧 write-safe

**📖 Spec:** `POST /rest/3/reporting/developer-space/{developerId}/marketing-attribution/async/export` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-marketing-attribution-async-export-post)

Start an async export of marketing-attribution data. Returns `{export:{id}}` — pass that id to `marketing_attribution_export_async_status` then `_download`. Filters: productId/addon/text/startDate/endDate (+ `accept` for the eventual download format). Export is param-deduped: identical params yield the same exportId.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID to scope the export to one app (verified: changes the exportId, so it affects the data). |
| `addon` | `string` | no | App key (e.g. `com.example.your-app`) to scope the export to one app. |
| `text` | `string` | no | Free-text search filter applied to the exported attribution rows. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |
| `accept` | `enum: csv, json` | no | Format the eventual download produces (`csv`\|`json`). The start response itself is always the `{export:{id}}` envelope. |

### `marketing_attribution_export_async_status`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/async/export/{exportId}/status` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-async-export-exportid-status-get)

Poll status of an async marketing-attribution export job. NOTE the generic /async/export/ path (shared, not prefixed).

| Arg | Type | Required | Description |
|---|---|---|---|
| `exportId` | `string` | yes |  |

## App requests & approvals

### `app_requests_and_approvals`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/app-requests-and-approvals` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-app-requests-and-approvals-get)

Marketplace 'request app' / 'approve app' activity, per month. Benchmark-style aggregate (NOT a paginated list): `{total:{name, appRequestsAndApprovalsPerMonth:[{date, appRequests, appRequestsApproved, appRequestsApprovalRate}]}, addons:[{addonKey, name, productId, appRequestsAndApprovalsPerAppPerMonth}]}`. Filter by addon (app key) or productId; hosting/pagination are silently ignored.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID. Narrows to one app. (Not in the HAL template but works.) |
| `addon` | `string` | no | App key (e.g. `com.example.your-app`). Narrows to one app. Alternative to `productId`. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

## Reviews

### `review_get`

**📖 Spec:** `GET /rest/3/products/{productId}/reviews/{reviewId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-reviewid-get)

Get a single review by ID.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `reviewId` | `string` | yes |  |

### `review_response_delete` ⚠️ destructive

**📖 Spec:** `DELETE /rest/3/products/{productId}/reviews/{reviewId}/response` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-reviewid-response-delete)

Delete the vendor's response to a review. PUBLIC IMPACT: removes a publicly visible response.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `reviewId` | `string` | yes |  |

### `review_response_put` ⚠️ destructive

**📖 Spec:** `PUT /rest/3/products/{productId}/reviews/{reviewId}/response` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-reviewid-response-put)

Post or update a vendor response to a review. PUBLIC IMPACT: response is visible to all Marketplace visitors.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `reviewId` | `string` | yes |  |
| `response` | `string` | yes | Response text body |

### `reviews_list`

**📖 Spec:** `GET /rest/3/products/{productId}/reviews` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-get)

List customer reviews for an app. CURSOR-paginated (not offset). Returns `{productId, reviews:[{id, content, stars, date, totalVotes, helpfulVotes, productHosting, isFlagged, authorName, transitionedToFiveStarRating}], cursor, count, averageStars}` where `count` is the total review count, `averageStars` the overall rating, and `cursor` the token for the next page. Pass `cursor` back to page forward. NOTE: reviews contain author names + free-text (PII).

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes | Product UUID (from apps_list / apps_known). |
| `hosting` | `enum: cloud, server, datacenter` | no | Filter reviews by the reviewer's hosting platform. Narrows by each row's `productHosting`. Invalid value → HTTP 400. |
| `sort` | `enum: recent, helpful, highest_rated, lowest_rated` | no | Sort order. `recent` (newest first), `helpful` (most helpful votes), `highest_rated`/`lowest_rated` (by stars). Invalid → HTTP 400. (The param is `sort` with these enum values — NOT `sortBy`/`order... |
| `limit` | `integer` | no | Page size (caps the `reviews[]` array). |
| `cursor` | `string` | no | Opaque pagination token from a previous response's `cursor`. This endpoint is cursor-based — `offset` is NOT supported (silently ignored). |

## Search keywords

### `search_keywords_by_app`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/products/{productId}/search-keywords` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-products-productid-search-keywords-get)

Top search keywords for one app. Returns `{summary:{addonName, addonKey, leadingSearchKeyword, …}, details:[{searchKeyword, keywordCount, elements:[{date,count}]}]}`. `productId` is a PATH segment. Filters: aggregation/startDate/endDate (pagination/hosting ignored).

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes | Product UUID (path segment; from apps_list / apps_known). |
| `aggregation` | `enum: week, month` | no | Time-series bucket cadence for the `elements[]` arrays. Default week. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

### `search_keywords_by_app_export`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/products/{productId}/search-keywords/export` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-products-productid-search-keywords-export-get)

Export variant of per-app search keywords. Returns the data INLINE as `{_links:{self,query,export}, summary, details}` — same payload as `search_keywords_by_app`. ⚠️ The advertised `_links.export` CSV/JSON download URLs are BROKEN (Atlassian-side doubled `/export/export` path → 404, verified 2026-06-03); use the inline `summary`/`details` directly. `productId` is a path segment.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes | Product UUID (path segment). |
| `aggregation` | `enum: week, month` | no | Time-series bucket cadence for the `elements[]` arrays. Default week. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |
| `accept` | `enum: csv, json` | no | Output format: `json` (default) or `csv` (returns a CSV string with a header row). Invalid → HTTP 400. |

### `search_keywords_by_source`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/search-keywords/source/{sourceKey}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-source-sourcekey-get)

Top search keywords for one source. Returns `{details:[{searchKeyword, percentage}]}` (flat keyword share, no time series). Filters: startDate/endDate (no aggregation; pagination ignored).

| Arg | Type | Required | Description |
|---|---|---|---|
| `sourceKey` | `enum: marketplace, embedded-marketplace` | yes | Search source. Allowable: `marketplace` (public marketplace.atlassian.com search) or `embedded-marketplace` (in-product 'find apps' search). Invalid → HTTP 400. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

### `search_keywords_by_source_export`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/search-keywords/source/{sourceKey}/export` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-source-sourcekey-export-get)

Export variant of source-filtered search keywords. UNLIKE the partner/by_app exports, this returns the FULL DATA directly as a JSON array of `{searchKeyword, percentage}` rows (up to 500), NOT HAL download links. Large responses spill to the truncation envelope.

| Arg | Type | Required | Description |
|---|---|---|---|
| `sourceKey` | `enum: marketplace, embedded-marketplace` | yes | Search source. Allowable: `marketplace` (public marketplace.atlassian.com search) or `embedded-marketplace` (in-product 'find apps' search). Invalid → HTTP 400. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |
| `accept` | `enum: csv, json` | no | Output format: `json` (default) or `csv` (returns a CSV string with a header row). Invalid → HTTP 400. |

### `search_keywords_partner`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/search-keywords` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-get)

Top search keywords across all the partner's apps (developer-space wide). Returns `{total:{searchAppearances, topSearchKeyword}, addons:[{addonName, addonKey, productId, leadingSearchKeyword, searchAppearances, elements:[{date,count}]}]}`. Filters: aggregation/startDate/endDate only (pagination/productId/hosting are ignored — it's an aggregate).

| Arg | Type | Required | Description |
|---|---|---|---|
| `aggregation` | `enum: week, month` | no | Time-series bucket cadence for the `elements[]` arrays. Default week. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

### `search_keywords_partner_export`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/search-keywords/export` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-export-get)

Export variant of partner-wide search keywords. With `accept=json` (default) returns the data INLINE as `{_links:{self,query,export}, total, addons}` (same payload as `search_keywords_partner`); with `accept=csv` returns a per-app CSV string. ⚠️ The advertised `_links.export` download URLs are BROKEN (Atlassian-side doubled `/export/export` path → 404, verified 2026-06-03) — use the inline data or `accept=csv` instead. Filters: aggregation/startDate/endDate.

| Arg | Type | Required | Description |
|---|---|---|---|
| `aggregation` | `enum: week, month` | no | Time-series bucket cadence for the `elements[]` arrays. Default week. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |
| `accept` | `enum: csv, json` | no | Output format: `json` (default) or `csv` (returns a CSV string with a header row). Invalid → HTTP 400. |

## Search keywords — zero results

### `zero_search_results_keywords`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/zero-search-results-keywords/source/{sourceKey}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-zero-search-results-keywords-source-sourcekey-get)

Keywords that produced ZERO search results, for one source — SEO gap analysis. Returns `{details:[{searchKeyword, count}]}` (count = how many times the no-result search happened). Filters: startDate/endDate (no aggregation; pagination ignored).

| Arg | Type | Required | Description |
|---|---|---|---|
| `sourceKey` | `enum: marketplace` | yes | Search source. ONLY `marketplace` is supported for zero-result keywords (unlike the other search-keyword tools, `embedded-marketplace` is rejected with HTTP 400). |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

### `zero_search_results_keywords_export`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/zero-search-results-keywords/source/{sourceKey}/export` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-zero-search-results-keywords-source-sourcekey-export-get)

Export variant of zero-result keywords. Returns the FULL DATA directly as a JSON array of `{searchKeyword, count}` rows (up to 500), NOT HAL download links (same as the by_source export). Large responses spill to the truncation envelope.

| Arg | Type | Required | Description |
|---|---|---|---|
| `sourceKey` | `enum: marketplace` | yes | Search source. ONLY `marketplace` is supported for zero-result keywords (unlike the other search-keyword tools, `embedded-marketplace` is rejected with HTTP 400). |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |
| `accept` | `enum: csv, json` | no | Output format: `json` (default) or `csv` (returns a CSV string with a header row). Invalid → HTTP 400. |

## Free starter tier

### `free_starter_tier_export`

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/freeStarterTier/export` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-freestartertier-export-get)

Export Cloud free-starter-tier entitlements (free users on your apps) as of a single date. Returns JSON array of `{day, licenseId, appEntitlementId, entitlementNumber, parentEdition, dateOfEvaluation, parentUnitCount, technicalEmail, vendorId, addonName, addonKey, productId}` by default; pass `accept=csv` for CSV. QUIRKS (Atlassian-side, verified 2026-06-03): (1) takes a SINGLE `date` snapshot — NOT a startDate/endDate range (ranges are silently ignored, yielding a future-dated default). (2) The CSV format OMITS the `productId` column that JSON includes (11 cols vs 12 keys). (3) A valid-shaped but non-existent `productId` returns HTTP 500 (not an empty result).

| Arg | Type | Required | Description |
|---|---|---|---|
| `date` | `string` | no | ISO date YYYY-MM-DD — the snapshot date. Omit for the API default (a future-dated default, so usually you want to set this). |
| `productId` | `string` | no | Product UUID — narrows the export to one app (verified: 263→50 rows, all matching). |
| `includeAtlassianLicenses` | `boolean` | no | Include internal Atlassian free-starter licenses in the export. |
| `accept` | `enum: csv, json` | no | Output format: `json` (default — array of entitlement rows) or `csv`. Invalid → HTTP 400. |

## App listing

### `app_listing_get`

**📖 Spec:** `GET /rest/3/product-listing/{productId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-productid-get)

Get Marketplace product listing metadata for one app. Returns `{productId, appKey, developerId, appName, summary, tagLine, images, tags, communityEnabled, developerLinks, thirdPartyIntegrations, state, approvalStatus, approvalDetails, slug, cloudComplianceBoundary, hostingVisibility, marketingLabels, revision, …}`. Unknown productId → HTTP 404.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes | Product UUID |

### `app_listing_update` ⚠️ destructive

**📖 Spec:** `PUT /rest/3/product-listing/{productId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-productid-put)

Update Marketplace product listing metadata. PUBLIC IMPACT: changes appear on the app's marketplace page after approval. PUT semantics — body should be a full listing object.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `body` | `object` | yes | Full listing payload (matches the GET response shape) |

## App software (versions, tokens)

### `app_software_get_by_appkey`

**📖 Spec:** `GET /rest/3/app-software/app-key/{appKey}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-app-key-appkey-get)

Look up app-software (the technical artifact behind a product listing) by its appKey. Returns an ARRAY of `{appSoftwareId, hosting, complianceBoundaries, archived}` — one entry per hosting platform the app supports. `complianceBoundaries` is a Cloud-only concept (an array like `["commercial"]` for cloud, `null` for server/datacenter). Use `hosting` to narrow to a single entry.

| Arg | Type | Required | Description |
|---|---|---|---|
| `appKey` | `string` | yes | App key like 'com.example.your-app' |
| `hosting` | `enum: cloud, server, datacenter` | no | Narrow to one hosting platform's app-software entry. Invalid → HTTP 400. |
| `complianceBoundaries` | `string` | no | Filter by compliance boundary (e.g. `commercial`). |

### `app_software_token_create` ⚠️ destructive

**📖 Spec:** `POST /rest/3/app-software/{id}/tokens` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-id-tokens-post)

Create a new access token for this app-software. CREDENTIAL: the returned token must be stored securely — Atlassian will not show it again.

| Arg | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `body` | `object` | no | Optional token-creation payload (scope, label, etc.) |

### `app_software_tokens_list`

**📖 Spec:** `GET /rest/3/app-software/{id}/tokens` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-id-tokens-get)

List API access tokens minted for this app-software. Returns `{tokens:[{token, cloudId, instance}]}` — each token maps to one Cloud install. CREDENTIAL-ADJACENT: exposes token identifiers + the customer cloud sites they belong to.

| Arg | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `token` | `string` | no | Look up a specific token value (spec param; accepted, filters server-side). |

### `app_software_version_create` ⚠️ destructive

**📖 Spec:** `POST /rest/3/app-software/{appSoftwareId}/versions` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-post)

Create a new version for an app-software. PUBLIC IMPACT (eventually): once a version is approved and listing is published, customers can install it.

| Arg | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `body` | `object` | yes | Version creation payload |

### `app_software_version_get`

**📖 Spec:** `GET /rest/3/app-software/{appSoftwareId}/versions/{buildNumber}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-get)

Get one version of an app-software by build number.

| Arg | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `buildNumber` | `string,number` | yes |  |

### `app_software_version_update` ⚠️ destructive

**📖 Spec:** `PUT /rest/3/app-software/{appSoftwareId}/versions/{buildNumber}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-put)

Update one version of an app-software (PUT — full replace).

| Arg | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `buildNumber` | `string,number` | yes |  |
| `body` | `object` | yes |  |

### `app_software_versions_list`

**📖 Spec:** `GET /rest/3/app-software/{appSoftwareId}/versions` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-get)

List versions for an app-software. Returns `{links, versions:[{buildNumber, versionNumber, compatibilities, supportedPaymentModel, frameworkDetails, licenseType, ...}], totalCount}`. CURSOR-paginated (`limit`+`cursor` from `links.next`) — `offset` is NOT supported (silently ignored).

| Arg | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `limit` | `integer` | no | Page size. |
| `cursor` | `string` | no | Opaque pagination token from `links.next`. |
| `state` | `enum: draft, submitted, approved, auto-approved, active, rejected, archived` | no | Filter by version state. |
| `paymentModel` | `enum: free, paid-via-atlassian, paid-via-vendor` | no | Filter by payment model. Invalid → HTTP 400. |
| `parentSoftwareId` | `string` | no | Filter by parent software (Atlassian product) id. Invalid → HTTP 400. |
| `parentSoftwareVersionId` | `string` | no | Filter by a specific parent-software version id. |
| `afterVersion` | `string` | no | Return versions after this version number. |

## App version listing

### `app_version_listing_create` ⚠️ destructive

**📖 Spec:** `POST /rest/3/app-software/{appSoftwareId}/versions/{buildNumber}/listing` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-version-listing/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-listing-post)

Create a new version-listing for a specific build. PUBLIC IMPACT (after approval): publishes a new app version to the Marketplace.

| Arg | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `buildNumber` | `string,number` | yes |  |
| `body` | `object` | yes | Version listing payload |

### `app_version_listing_get`

**📖 Spec:** `GET /rest/3/app-software/{appSoftwareId}/versions/{buildNumber}/listing` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-version-listing/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-listing-get)

Get the version-listing for a specific build number.

| Arg | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `buildNumber` | `string,number` | yes |  |

### `app_version_listing_update` ⚠️ destructive

**📖 Spec:** `PUT /rest/3/app-software/{appSoftwareId}/versions/{buildNumber}/listing` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-version-listing/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-listing-put)

Update an existing version-listing (PUT — full replace). PUBLIC IMPACT: changes the customer-facing version metadata after approval.

| Arg | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `buildNumber` | `string,number` | yes |  |
| `body` | `object` | yes |  |

### `app_version_listings_list_all`

**📖 Spec:** `GET /rest/3/app-software/{appSoftwareId}/listings/all` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-version-listing/#api-rest-3-app-software-appsoftwareid-listings-all-get)

List version-listings for an app-software (per-version published metadata: screenshots, highlights, moreDetails, youtubeId, developerLinks, approvalStatus, state, buildNumber, revision). Returns `{links, versions:[…]}`. Despite the name, it's CURSOR-paginated (default 10/page; pass `cursor` from `links.next`). Filter by `state` (PRIVATE/PUBLIC) and `approvalStatus` (both verified to narrow at the payload level; an unknown value returns an empty list, not an error).

| Arg | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `limit` | `integer` | no | Page size (default 10). |
| `cursor` | `string` | no | Opaque pagination token from `links.next`. |
| `state` | `enum: PRIVATE, PUBLIC` | no | Filter by listing visibility state. |
| `approvalStatus` | `enum: APPROVED, SUBMITTED, REJECTED, UNINITIATED` | no | Filter by Marketplace approval status. |

## Privacy & security

### `privacy_security_draft_delete` ⚠️ destructive

**📖 Spec:** `DELETE /rest/3/privacy-and-security/products/{productId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-delete)

Delete the draft privacy-and-security info (the currently published version is unaffected).

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |

### `privacy_security_draft_put` ⚠️ destructive

**📖 Spec:** `PUT /rest/3/privacy-and-security/products/{productId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-put)

Create or update the draft privacy-and-security information (not yet public). PUT — full replace.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `body` | `object` | yes | Full privacy-and-security payload |

### `privacy_security_get`

**📖 Spec:** `GET /rest/3/privacy-and-security/products/{productId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-get)

Get privacy & security information for an app (used by enterprise procurement reviewers). Returns `{commonCloud:{dataAccessAndStorage, logDetails, dataResidency, privacy, security, properties, hasRestAPIExtension, supportsConfigurableEgress}}`. `state=live` (default) returns the published version; `state=draft` the unpublished draft (404 if none exists). Invalid state → HTTP 400.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `state` | `enum: live, draft` | no | Which version to fetch: `live` (published, default) or `draft` (unpublished). Invalid → HTTP 400; `draft` → 404 if none exists. |

### `privacy_security_publish` ⚠️ destructive

**📖 Spec:** `POST /rest/3/privacy-and-security/products/{productId}/publish` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-publish-post)

Publish the current draft privacy-and-security info. PUBLIC IMPACT: this version becomes visible to all Marketplace visitors and procurement reviewers.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |

## Cloud migration compatibility

### `cloud_migration_compat_create` ⚠️ destructive

**📖 Spec:** `PUT /rest/3/cloud-migration-compatibility/products/{productId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-migrations/#api-rest-3-cloud-migration-compatibility-products-productid-put)

Create cloud-migration compatibility info for an app. PUT semantics — body is the full document.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `body` | `object` | yes | Migration compatibility payload |

### `cloud_migration_compat_get`

**📖 Spec:** `GET /rest/3/cloud-migration-compatibility/products/{productId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-migrations/#api-rest-3-cloud-migration-compatibility-products-productid-get)

Get DC-to-Cloud migration compatibility info for an app. Returns `{developerId, productId, addonKey, addonName, cloudMigrationAssistantCompatibility, migrationPath, isDualLicenseOptedIn}`. NOTE: returns HTTP 404 (surfaced as an error) for apps that have no migration-compatibility record configured — not every app has one. No query params; productId is a path segment.

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes | Product UUID (path segment). |

### `cloud_migration_compat_update` ⚠️ destructive

**📖 Spec:** `PATCH /rest/3/cloud-migration-compatibility/products/{productId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-migrations/#api-rest-3-cloud-migration-compatibility-products-productid-patch)

Patch cloud-migration compatibility info (partial update).

| Arg | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `body` | `object` | yes | Partial migration compatibility payload |

## Parent software

### `parent_software_get`

**📖 Spec:** `GET /rest/3/parent-software/{parentSoftwareId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-parentsoftwareid-get)

Get one parent software (Atlassian product) by ID (e.g. `jira`, `confluence`). Returns `{id, developerId:'Atlassian', name, hostingOptions:[{hosting}], extensibilityFrameworks, state, revision}`. Nonexistent id → HTTP 404.

| Arg | Type | Required | Description |
|---|---|---|---|
| `parentSoftwareId` | `string` | yes | Parent-software id, e.g. `jira` (from parent_software_list). |

### `parent_software_list`

**📖 Spec:** `GET /rest/3/parent-software` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-get)

List parent software (the Atlassian products your apps target — Jira, Confluence, Bitbucket, etc.). Returns `{links, parentSoftware:[…]}`. CURSOR-paginated (`limit`+`cursor` from `links.next`); the default page returns all ~23 products.

| Arg | Type | Required | Description |
|---|---|---|---|
| `limit` | `integer` | no | Page size. Omit to get the full default page. |
| `cursor` | `string` | no | Opaque pagination token from a prior response's `links.next`. |

### `parent_software_version_by_build`

**📖 Spec:** `GET /rest/3/parent-software/{parentSoftwareId}/versions/build/{buildNumber}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-parentsoftwareid-versions-build-buildnumber-get)

Get a parent-software version by its build number (path `/versions/build/{buildNumber}`). Returns `{buildNumber, versionNumber, hosting:[…], state, revision, createdAt}`. Unknown build → HTTP 404.

| Arg | Type | Required | Description |
|---|---|---|---|
| `parentSoftwareId` | `string` | yes |  |
| `buildNumber` | `string,number` | yes |  |

### `parent_software_version_by_number`

**📖 Spec:** `GET /rest/3/parent-software/{id}/versions/number/{versionNumber}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-id-versions-number-versionnumber-get)

Get a parent-software version by its human-readable version number (path `/versions/number/{versionNumber}`, e.g. '11.3.8'). Same record shape as version_by_build (`{buildNumber, versionNumber, hosting, state, revision, createdAt}`). Unknown version → HTTP 404.

| Arg | Type | Required | Description |
|---|---|---|---|
| `parentSoftwareId` | `string` | yes |  |
| `versionNumber` | `string` | yes |  |

### `parent_software_versions_list`

**📖 Spec:** `GET /rest/3/parent-software/{parentSoftwareId}/versions` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-parentsoftwareid-versions-get)

List known versions of a parent software (e.g. Jira versions Atlassian has published). CURSOR-paginated (`limit`+`cursor` from `links.next`).

| Arg | Type | Required | Description |
|---|---|---|---|
| `parentSoftwareId` | `string` | yes |  |
| `limit` | `integer` | no | Page size. Omit to get the full default page. |
| `cursor` | `string` | no | Opaque pagination token from a prior response's `links.next`. |

## Developer space (admin)

### `developer_space_by_vendor`

**📖 Spec:** `GET /rest/3/developer-space/vendor/{vendorId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-vendor-vendorid-get)

Resolve a developerId from a vendorId (legacy mapping).

| Arg | Type | Required | Description |
|---|---|---|---|
| `vendorId` | `string` | yes |  |

### `developer_space_catalog_account`

**📖 Spec:** `GET /rest/3/developer-space/{developerId}/catalog-account` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-catalog-account-get)

Get the catalog-account ID for a developer space (used by some downstream services).

| Arg | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no |  |

### `developer_space_get`

**📖 Spec:** `GET /rest/3/developer-space/{developerId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-get)

Get developer space profile by developerId. Returns `{id, vendorId, name, status, type, organisationId, version}`. Defaults to MARKETPLACE_DEVELOPER_ID. Unknown/malformed id → HTTP 400.

| Arg | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no | Defaults to MARKETPLACE_DEVELOPER_ID |

### `developer_space_listings`

**📖 Spec:** `GET /rest/3/developer-space/{developerId}/listings` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-listings-get)

Get the developer-profile listing documents (developer profile copy, web metadata, etc.). Returns a bare ARRAY of listing objects (not an envelope). NOT the product apps — use apps_list for those.

| Arg | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no |  |

### `developer_space_member_add` ⚠️ destructive

**📖 Spec:** `POST /rest/3/developer-space/{developerId}/members/{aaid}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-aaid-post)

Add a user to the developer space. AFFECTS OTHERS: grants console access to this user.

| Arg | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no |  |
| `aaid` | `string` | yes |  |
| `body` | `object` | no | Optional payload (role, etc.) |

### `developer_space_member_get`

**📖 Spec:** `GET /rest/3/developer-space/{developerId}/members/{aaid}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-aaid-get)

Get one developer-space team member by Atlassian account id (aaid). Returns `{aaid, roles, categories, email, userName}` — contains PII (email, userName). Unknown aaid → HTTP 400.

| Arg | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no |  |
| `aaid` | `string` | yes | Atlassian account ID |

### `developer_space_member_remove` ⚠️ destructive

**📖 Spec:** `DELETE /rest/3/developer-space/{developerId}/members/{aaid}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-aaid-delete)

Remove a user from the developer space. AFFECTS OTHERS: revokes their console access.

| Arg | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no |  |
| `aaid` | `string` | yes |  |

### `developer_space_member_update` ⚠️ destructive

**📖 Spec:** `PUT /rest/3/developer-space/{developerId}/members/{aaid}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-aaid-put)

Update a developer-space team member (PUT — full replace).

| Arg | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no |  |
| `aaid` | `string` | yes |  |
| `body` | `object` | yes |  |

### `developer_space_members_list`

**📖 Spec:** `GET /rest/3/developer-space/{developerId}/members?limit={limit}&cursor={cursor}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-limit-limit-cursor-cursor-get)

List team members in the developer space. Returns `{members:[{aaid, roles, categories, email, userName}], next}`. CURSOR-paginated, but with a NON-STANDARD shape (unlike the `links.next` URL used by other list tools): `next` is a BARE opaque cursor token (or absent on the last page) — pass its value straight back as the `cursor` param to get the following page. Page size via `limit` (default 10, max 50).

| Arg | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no |  |
| `cursor` | `string` | no | Opaque token from the previous response's top-level `next` field (a bare token, NOT a URL). |
| `limit` | `integer` | no | Page size (default 10, max 50). |

## Partner metrics

### `partner_metrics_fetch`

**📖 Spec:** `POST /rest/3/partner-metrics/developer-space/{developerId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-partner-metrics-developer-space-developerid-post)

Fetch partner-metric time series (POST). The `body` shape is `ReportingMetricTimeSeriesRequestBody`: `{metrics:{metricSets:[…], metricFields:[…]}, dateRange:{startDate, endDate}, granularity:'YEAR'|'MONTH'|'WEEK'|'DAY', attributes?, sortByList?, attributeFilter?}`. IMPORTANT: `metrics` is an OBJECT (not an array) and `metricSets`/`metricFields` are arrays of OBJECTS; `dateRange` uses `startDate`/`endDate` (not start/end). A wrong shape returns HTTP 400 with a JSON-parse error message. `limit`/`offset` are query params for paging the result rows.

| Arg | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no |  |
| `limit` | `integer` | no | Max result rows to return. |
| `offset` | `integer` | no | Result-row offset for paging. |
| `body` | `object` | yes | ReportingMetricTimeSeriesRequestBody — see the tool description for the required shape. |

## Product catalog

### `product_catalog_latest`

**📖 Spec:** `GET /rest/3/reporting/product-catalog/latest` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-product-catalog-latest-get)

Get a presigned S3 URL for the latest public Marketplace app-catalog snapshot. Response shape: {date, presignedUrl, expiresInSeconds}. The presignedUrl points to a LARGE CSV file (~150 MB, Content-Type binary/octet-stream — NOT JSON), one row per published app with columns like: is_beta, summary, tag_line, is_connect, product_id, released_at, vendor_name, is_supported, review_score, average_stars, install_count, download_count, version_number, version_status, publicly_visible, number_of_reviews, category_name_list, marketplace_app_key, app_software_hosting. This is the whole public app marketplace (all vendors' apps), NOT your own apps or Atlassian's product/pricing structure. presignedUrl expires in ~300s — download promptly.

*(no args)*

## Artifacts

### `artifact_fetch_from_url` 🔧 write-safe

**📖 Spec:** `POST /rest/3/artifacts/fetch` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-assets/#api-rest-3-artifacts-fetch-post)

Have Atlassian fetch an artifact from a public URL and store it. Returns `{fileInfo, _links, details}` — the stored artifact's id/download link live under `_links`/`fileInfo`. NOTE: the API field is `uri` (not `url`); this tool accepts `url` and maps it to `uri` for you.

| Arg | Type | Required | Description |
|---|---|---|---|
| `url` | `string` | yes | Public URL of the artifact to fetch and store (sent to the API as the required `uri` field). |
| `extra` | `object` | no | Optional extra fields to include in the fetch request body |

### `artifact_get`

**📖 Spec:** `GET /rest/3/artifacts/{artifactId}` — [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-assets/#api-rest-3-artifacts-artifactid-get)

Get artifact metadata (name, size, content type, download URL).

| Arg | Type | Required | Description |
|---|---|---|---|
| `artifactId` | `string` | yes |  |

