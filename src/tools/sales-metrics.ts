import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, seg, REPORTING_BASE, READ_ONLY, EXPORT_TIMEOUT_MS, ACCEPT_CSV_JSON, exportAcceptHeader } from "./_shared.js";

const METRICS_BASE = `${REPORTING_BASE}/sales/metrics`;

/**
 * Filter set for AGGREGATE sales-metric endpoints (churn / conversion / renewal).
 *
 * Per the HAL `_links.query.href` template returned by the API, these endpoints
 * accept ONLY `aggregation`, `startDate`, `endDate`. Passing `productId`,
 * `hosting`, `addon`, `tier` etc. returns 200 but is **silently ignored**
 * (verified 2026-06-02: totals identical with/without those params). So we
 * don't expose them here — that would mislead callers.
 */
export const AGGREGATE_FILTERS = {
  aggregation: z.enum(["week", "month"]).optional()
    .describe("Time-series bucket cadence. Default: week. Affects the number of `elements[]` returned per series."),
  startDate: z.string().optional().describe("ISO date YYYY-MM-DD (inclusive lower bound)."),
  endDate: z.string().optional().describe("ISO date YYYY-MM-DD (inclusive upper bound)."),
};

/**
 * Filter set for `metrics_churn_benchmark`. Per HAL `_links.query.href` template
 * the API advertises `{?addon*, startDate, endDate}` — BUT `productId` also
 * works as a real filter, verified empirically (2026-06-02). HAL template is
 * incomplete here.
 *
 * Multi-value handling (verified live):
 * - `addon`: BOTH `addon=a&addon=b` (repeated) and `addon=a,b` (comma) work.
 * - `productId`: ONLY `productId=A&productId=B` (repeated) works. Comma form
 *   `productId=A,B` is silently mis-parsed and returns ALL apps.
 *
 * Precedence: when BOTH `productId` and `addon` are passed, `productId` wins
 * and `addon` is silently ignored.
 *
 * Publication lag: benchmark data has a ~2-3 month lag behind real-time. The
 * latest available month is typically 2-3 months before today. Queries with
 * narrow windows close to "now" can return empty `churnBenchmarkPerApp[]`.
 */
export const BENCHMARK_FILTERS = {
  addon: z.string().optional()
    .describe("App key (e.g. `com.example.your-app` — NOT productId UUID). Single value via this MCP. Silently ignored if `productId` is also passed."),
  productId: z.string().optional()
    .describe("Product UUID. Single value. Not documented in Atlassian's HAL query template but works as a real filter. When BOTH `addon` and `productId` are passed, `productId` wins. Invalid or non-matching UUIDs are silently ignored (full list returned)."),
  startDate: z.string().optional().describe("ISO date YYYY-MM-DD. Trims `churnBenchmarkPerMonth[]` to months overlapping the window."),
  endDate: z.string().optional().describe("ISO date YYYY-MM-DD. Note: data has a ~2-3 month publication lag; very recent windows can return empty `churnBenchmarkPerApp[]`."),
};

/**
 * Filter set for `metrics_details_by_metric` and `metrics_details_export`.
 * Per HAL query template:
 * `{?addon*, hosting*, lastUpdated, partnerType*, text, startDate, endDate, sortBy, order, offset, limit}`.
 *
 * Caveats verified 2026-06-02:
 * - `limit` is server-capped at 50 (passing 100 still returns 50).
 * - `sortBy` accepts exactly: `addonName`, `date`, `hosting`, `transactionId`,
 *   `licenseId`. Anything else returns HTTP 400 with the allowed list.
 * - `productId` is NOT accepted here either — use `addon` (the app key).
 * - Response objects use the case `"Data center"` (lowercase 'c') for hosting,
 *   unlike licenses_list which returns `"Data Center"`. Atlassian-side inconsistency.
 */
export const DETAILS_FILTERS = {
  productId: z.string().optional()
    .describe("Product UUID — narrows events to one app (documented + verified 2026-06-03; all returned rows match)."),
  appEdition: z.enum(["free", "standard", "advanced"]).optional()
    .describe("Filter by app edition (free/standard/advanced)."),
  addon: z.string().optional()
    .describe("App key (e.g. `com.example.your-app`). Undocumented but works as an app filter. Prefer `productId`."),
  hosting: z.enum(["cloud", "datacenter", "server"]).optional()
    .describe("Filter events by hosting. Response objects use capitalized 'Cloud'/'Server'/'Data Center'."),
  partnerType: z.enum(["direct", "expert", "reseller"]).optional()
    .describe("Filter by partner attribution channel: `direct`, `expert`, `reseller`. NOTE: Atlassian's error message also lists `upgrade` as allowable, but passing it returns HTTP 400 (Atlassian-side contradiction, verified 2026-06-03) — so it's excluded here."),
  text: z.string().optional()
    .describe("Free-text search across event identifiers (SEN / appEntitlementNumber, transactionId, customer email, etc). Verified to narrow correctly."),
  lastUpdated: z.string().optional()
    .describe("ISO date YYYY-MM-DD — events whose lastUpdated is on/after this date. Verified to narrow correctly."),
  startDate: z.string().optional().describe("ISO date YYYY-MM-DD (filters by eventDate)."),
  endDate: z.string().optional().describe("ISO date YYYY-MM-DD (filters by eventDate)."),
  sortBy: z.enum(["addonName", "date", "hosting", "transactionId", "licenseId"]).optional()
    .describe("Sort field. Allowed per Atlassian: `addonName`, `date`, `hosting`, `transactionId`, `licenseId`. Anything else → HTTP 400. Only meaningful combined with `order=asc` (see `order`)."),
  order: z.enum(["asc", "desc"]).optional()
    .describe("Sort direction. **`asc` works; `desc` is unreliable on this endpoint** — Atlassian returns a non-monotonic ordering for `order=desc` (verified 2026-06-03). With no `sortBy`, `order` is ignored entirely. Prefer `sortBy=date&order=asc` and reverse client-side if you need descending."),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(50).optional()
    .describe("Max 50 (server hard-cap; values above are clamped to 50)."),
};

/**
 * Filter set for `metrics_details_export` (the CSV sibling). Identical to
 * `DETAILS_FILTERS` EXCEPT it omits `offset` and `limit` — the export endpoint
 * is a full dump and silently ignores both (verified 2026-06-03: limit=1 still
 * returned all rows). Exposing them would mislead callers into thinking they
 * can page/cap the CSV.
 */
const { offset: _omitOffset, limit: _omitLimit, ...EXPORT_DETAILS_FILTERS } = DETAILS_FILTERS;

// <auto-tsdoc-begin>
/**
 * Tool group registered from `sales-metrics.ts` (6 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `metrics_churn` | `GET` | `/rest/3/reporting/developer-space/{developerId}/sales/metrics/churn` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-churn-get) |
 * | `metrics_churn_benchmark` | `GET` | `/rest/3/reporting/developer-space/{developerId}/sales/metrics/churn/benchmark` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-churn-benchmark-get) |
 * | `metrics_conversion` | `GET` | `/rest/3/reporting/developer-space/{developerId}/sales/metrics/conversion` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-conversion-get) |
 * | `metrics_renewal` | `GET` | `/rest/3/reporting/developer-space/{developerId}/sales/metrics/renewal` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-renewal-get) |
 * | `metrics_details_by_metric` | `GET` | `/rest/3/reporting/developer-space/{developerId}/sales/metrics/{saleMetric}/details` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-salemetric-details-get) |
 * | `metrics_details_export` | `GET` | `/rest/3/reporting/developer-space/{developerId}/sales/metrics/{saleMetric}/details/export` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-salemetric-details-export-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`metrics_churn`, `metrics_churn_benchmark`, `metrics_conversion`, `metrics_renewal`, `metrics_details_by_metric`, `metrics_details_export`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerSalesMetricsTools } from "./tools/sales-metrics.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerSalesMetricsTools(server);
 * // Now these tools are live: `metrics_churn`, `metrics_churn_benchmark`, `metrics_conversion`, …
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerSalesMetricsTools(server: McpServer): void {
  server.tool(
    "metrics_churn",
    "Cloud churn TIME-SERIES (not a single rate). Returns `total.datasets` split by billing period (`Monthly`, `Annual`) with two series each: `Customers` (cohort denominator) and `Cancellations` (numerator), plus per-app breakdown in `addons[]`. Caller computes rate = Cancellations / Customers per bucket. Only 3 filters work (aggregation/startDate/endDate); productId/hosting/addon are silently ignored on this aggregate endpoint.",
    AGGREGATE_FILTERS,
    READ_ONLY,
    async (args) =>
      jsonResult(await request({ path: `${METRICS_BASE}/churn`, query: asQuery(args) }))
  );

  server.tool(
    "metrics_churn_benchmark",
    "Per-app monthly churn benchmark vs. ecosystem average. Returns `churnBenchmarkPerApp[]` where each entry has `churnBenchmarkPerMonth[]` rows: `{year, month, churnedLicenses, totalLicenses, churnRate, isolatedChurnRate, churnRateBenchmark, isolatedChurnRateBenchmark}`. The `*Benchmark` fields are normalized so 1.0 ≈ ecosystem average. Filter by `addon` (app key) or `productId` (UUID). Note: data has a ~2-3 month publication lag. Default (no filter) returns full history for all apps — large response (~60KB) triggers the truncation envelope. Use date range to narrow.",
    BENCHMARK_FILTERS,
    READ_ONLY,
    async (args) =>
      jsonResult(await request({ path: `${METRICS_BASE}/churn/benchmark`, query: asQuery(args) }))
  );

  server.tool(
    "metrics_conversion",
    "Cloud evaluation→paid conversion TIME-SERIES. Shape differs from churn/renewal: `total.series[]` is FLAT (no `datasets[]` billing-period split) with two series — `Evaluations` (denominator) and `Conversions` (numerator) — each a list of `{date, count}` elements. No `uniqueTotal` field. `addons[]` carry `series` directly. Caller computes conversion rate = Conversions / Evaluations per bucket. Only aggregation/startDate/endDate work; other filters silently ignored. Reversed or future-only ranges return empty `series`/`addons`.",
    AGGREGATE_FILTERS,
    READ_ONLY,
    async (args) =>
      jsonResult(await request({ path: `${METRICS_BASE}/conversion`, query: asQuery(args) }))
  );

  server.tool(
    "metrics_renewal",
    "Cloud renewal TIME-SERIES. `total.datasets[]` split by billing period (`Annual`, `Monthly`) — like churn — with two series each: `Renewal opportunities` (denominator) and `Renewals` (numerator). NOTE: unlike churn, renewal series have NO `uniqueTotal` field (each series is just `{name, elements:[{date,count}]}`). `addons[]` carry `datasets`. Caller computes renewal rate = Renewals / Renewal opportunities per bucket. Only aggregation/startDate/endDate work; other filters silently ignored. Reversed/future ranges return empty datasets+addons.",
    AGGREGATE_FILTERS,
    READ_ONLY,
    async (args) =>
      jsonResult(await request({ path: `${METRICS_BASE}/renewal`, query: asQuery(args) }))
  );

  server.tool(
    "metrics_details_by_metric",
    "License-event details underlying a sale metric. Returns `events[]` rows: `{addonKey, addonName, hosting, lastUpdated, eventDate, transactionId, licenseDetails, productId}`. Supports rich filters (addon, hosting, partnerType, text, sortBy, order, offset, limit). Server caps limit at 50.",
    {
      saleMetric: z.enum(["churn", "conversion", "renewal"])
        .describe("Which underlying metric's events to fetch."),
      ...DETAILS_FILTERS,
    },
    READ_ONLY,
    async ({ saleMetric, ...filters }) =>
      jsonResult(await request({
        path: `${METRICS_BASE}/${seg(saleMetric)}/details`,
        query: asQuery(filters),
      }))
  );

  server.tool(
    "metrics_details_export",
    "Export of license-event details for a sale metric. `accept=csv` (default) returns the 17-column CSV (`addonName,addonKey,hosting,lastUpdated,eventDate,transactionId,licenseId,maintenanceStartDate,maintenanceEndDate,monthsValid,appEntitlementId,appEntitlementNumber,cloudId,inGracePeriod,multiInstanceEntitlementId,multiInstanceEntitlementNumber,appEdition`); `accept=json` returns a JSON array. Same filters as `metrics_details_by_metric` EXCEPT no `offset`/`limit` (full dump). 10-minute timeout (override via EXPORT_TIMEOUT_MS). Large exports spill to a tmp file via the truncation envelope.",
    {
      saleMetric: z.enum(["churn", "conversion", "renewal"])
        .describe("Which underlying metric's events to export."),
      ...EXPORT_DETAILS_FILTERS,
      ...ACCEPT_CSV_JSON,
    },
    READ_ONLY,
    async ({ saleMetric, ...filters }) =>
      jsonResult(await request({
        path: `${METRICS_BASE}/${seg(saleMetric)}/details/export`,
        query: asQuery(filters),
        accept: exportAcceptHeader(filters.accept),
        timeoutMs: EXPORT_TIMEOUT_MS,
      }))
  );
}
