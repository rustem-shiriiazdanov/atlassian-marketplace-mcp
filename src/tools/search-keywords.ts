import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, REPORTING_BASE, READ_ONLY } from "./_shared.js";

/**
 * Search-keyword endpoints are aggregates, NOT paginated lists — `offset`/`limit`/
 * `sortBy`/`order` and `productId`/`hosting` (query) are all silently ignored
 * (verified 2026-06-03). Real accepted params per endpoint:
 *  - partner & by_app: `{?aggregation,startDate,endDate}`
 *  - by_source & zero-results: `{?startDate,endDate}` (no aggregation)
 * `sourceKey` is a strict enum (`marketplace` | `embedded-marketplace`); `productId`
 * is a PATH segment on the by_app variants.
 */
const SK_DATE = {
  startDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
  endDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
};
const SK_DATE_AGG = {
  aggregation: z.enum(["week", "month"]).optional()
    .describe("Time-series bucket cadence for the `elements[]` arrays. Default week."),
  ...SK_DATE,
};
const SK_SOURCE = z.enum(["marketplace", "embedded-marketplace"])
  .describe("Search source. Allowable: `marketplace` (public marketplace.atlassian.com search) or `embedded-marketplace` (in-product 'find apps' search). Invalid → HTTP 400.");

// Zero-results is ONLY tracked for the public marketplace — the in-product
// search doesn't surface zero-result keywords. `embedded-marketplace` here
// returns HTTP 400 "source: allowable value is 'marketplace'" (verified 2026-06-03).
const SK_SOURCE_ZERO = z.enum(["marketplace"])
  .describe("Search source. ONLY `marketplace` is supported for zero-result keywords (unlike the other search-keyword tools, `embedded-marketplace` is rejected with HTTP 400).");

// `accept` query param on the EXPORT endpoints selects the output format
// (verified 2026-06-03; invalid → HTTP 400 "allowable values are 'csv','json'").
// Default (omitted) → JSON. `csv` returns a flat, header-rowed CSV string —
// often more useful than the JSON shape (e.g. partner export CSV is per-app rows).
const SK_ACCEPT = {
  accept: z.enum(["csv", "json"]).optional()
    .describe("Output format: `json` (default) or `csv` (returns a CSV string with a header row). Invalid → HTTP 400."),
};

// <auto-tsdoc-begin>
/**
 * Tool group registered from `search-keywords.ts` (8 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `search_keywords_partner` | `GET` | `/rest/3/reporting/developer-space/{developerId}/search-keywords` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-get) |
 * | `search_keywords_partner_export` | `GET` | `/rest/3/reporting/developer-space/{developerId}/search-keywords/export` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-export-get) |
 * | `search_keywords_by_source` | `GET` | `/rest/3/reporting/developer-space/{developerId}/search-keywords/source/{sourceKey}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-source-sourcekey-get) |
 * | `search_keywords_by_source_export` | `GET` | `/rest/3/reporting/developer-space/{developerId}/search-keywords/source/{sourceKey}/export` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-source-sourcekey-export-get) |
 * | `search_keywords_by_app` | `GET` | `/rest/3/reporting/developer-space/{developerId}/products/{productId}/search-keywords` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-products-productid-search-keywords-get) |
 * | `search_keywords_by_app_export` | `GET` | `/rest/3/reporting/developer-space/{developerId}/products/{productId}/search-keywords/export` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-products-productid-search-keywords-export-get) |
 * | `zero_search_results_keywords` | `GET` | `/rest/3/reporting/developer-space/{developerId}/zero-search-results-keywords/source/{sourceKey}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-zero-search-results-keywords-source-sourcekey-get) |
 * | `zero_search_results_keywords_export` | `GET` | `/rest/3/reporting/developer-space/{developerId}/zero-search-results-keywords/source/{sourceKey}/export` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-zero-search-results-keywords-source-sourcekey-export-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`search_keywords_partner`, `search_keywords_partner_export`, `search_keywords_by_source`, `search_keywords_by_source_export`, `search_keywords_by_app`, `search_keywords_by_app_export`, `zero_search_results_keywords`, `zero_search_results_keywords_export`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerSearchKeywordTools } from "./tools/search-keywords.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerSearchKeywordTools(server);
 * // Now these tools are live: `search_keywords_partner`, `search_keywords_partner_export`, `search_keywords_by_source`, …
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerSearchKeywordTools(server: McpServer): void {
  server.tool(
    "search_keywords_partner",
    "Top search keywords across all the partner's apps (developer-space wide). Returns `{total:{searchAppearances, topSearchKeyword}, addons:[{addonName, addonKey, productId, leadingSearchKeyword, searchAppearances, elements:[{date,count}]}]}`. Filters: aggregation/startDate/endDate only (pagination/productId/hosting are ignored — it's an aggregate).",
    SK_DATE_AGG,
    READ_ONLY,
    async (args) =>
      jsonResult(await request({
        path: `${REPORTING_BASE}/search-keywords`,
        query: asQuery(args),
      }))
  );

  server.tool(
    "search_keywords_partner_export",
    "Export variant of partner-wide search keywords. With `accept=json` (default) returns the data INLINE as `{_links:{self,query,export}, total, addons}` (same payload as `search_keywords_partner`); with `accept=csv` returns a per-app CSV string. ⚠️ The advertised `_links.export` download URLs are BROKEN (Atlassian-side doubled `/export/export` path → 404, verified 2026-06-03) — use the inline data or `accept=csv` instead. Filters: aggregation/startDate/endDate.",
    { ...SK_DATE_AGG, ...SK_ACCEPT },
    READ_ONLY,
    async (args) =>
      jsonResult(await request({
        path: `${REPORTING_BASE}/search-keywords/export`,
        query: asQuery(args),
      }))
  );

  server.tool(
    "search_keywords_by_source",
    "Top search keywords for one source. Returns `{details:[{searchKeyword, percentage}]}` (flat keyword share, no time series). Filters: startDate/endDate (no aggregation; pagination ignored).",
    {
      sourceKey: SK_SOURCE,
      ...SK_DATE,
    },
    READ_ONLY,
    async ({ sourceKey, ...filters }) =>
      jsonResult(await request({
        path: `${REPORTING_BASE}/search-keywords/source/${sourceKey}`,
        query: asQuery(filters),
      }))
  );

  server.tool(
    "search_keywords_by_source_export",
    "Export variant of source-filtered search keywords. UNLIKE the partner/by_app exports, this returns the FULL DATA directly as a JSON array of `{searchKeyword, percentage}` rows (up to 500), NOT HAL download links. Large responses spill to the truncation envelope.",
    {
      sourceKey: SK_SOURCE,
      ...SK_DATE,
      ...SK_ACCEPT,
    },
    READ_ONLY,
    async ({ sourceKey, ...filters }) =>
      jsonResult(await request({
        path: `${REPORTING_BASE}/search-keywords/source/${sourceKey}/export`,
        query: asQuery(filters),
      }))
  );

  server.tool(
    "search_keywords_by_app",
    "Top search keywords for one app. Returns `{summary:{addonName, addonKey, leadingSearchKeyword, …}, details:[{searchKeyword, keywordCount, elements:[{date,count}]}]}`. `productId` is a PATH segment. Filters: aggregation/startDate/endDate (pagination/hosting ignored).",
    {
      productId: z.string().describe("Product UUID (path segment; from apps_list / apps_known)."),
      ...SK_DATE_AGG,
    },
    READ_ONLY,
    async ({ productId, ...filters }) =>
      jsonResult(await request({
        path: `${REPORTING_BASE}/products/${productId}/search-keywords`,
        query: asQuery(filters),
      }))
  );

  server.tool(
    "search_keywords_by_app_export",
    "Export variant of per-app search keywords. Returns the data INLINE as `{_links:{self,query,export}, summary, details}` — same payload as `search_keywords_by_app`. ⚠️ The advertised `_links.export` CSV/JSON download URLs are BROKEN (Atlassian-side doubled `/export/export` path → 404, verified 2026-06-03); use the inline `summary`/`details` directly. `productId` is a path segment.",
    {
      productId: z.string().describe("Product UUID (path segment)."),
      ...SK_DATE_AGG,
      ...SK_ACCEPT,
    },
    READ_ONLY,
    async ({ productId, ...filters }) =>
      jsonResult(await request({
        path: `${REPORTING_BASE}/products/${productId}/search-keywords/export`,
        query: asQuery(filters),
      }))
  );

  server.tool(
    "zero_search_results_keywords",
    "Keywords that produced ZERO search results, for one source — SEO gap analysis. Returns `{details:[{searchKeyword, count}]}` (count = how many times the no-result search happened). Filters: startDate/endDate (no aggregation; pagination ignored).",
    {
      sourceKey: SK_SOURCE_ZERO,
      ...SK_DATE,
    },
    READ_ONLY,
    async ({ sourceKey, ...filters }) =>
      jsonResult(await request({
        path: `${REPORTING_BASE}/zero-search-results-keywords/source/${sourceKey}`,
        query: asQuery(filters),
      }))
  );

  server.tool(
    "zero_search_results_keywords_export",
    "Export variant of zero-result keywords. Returns the FULL DATA directly as a JSON array of `{searchKeyword, count}` rows (up to 500), NOT HAL download links (same as the by_source export). Large responses spill to the truncation envelope.",
    {
      sourceKey: SK_SOURCE_ZERO,
      ...SK_DATE,
      ...SK_ACCEPT,
    },
    READ_ONLY,
    async ({ sourceKey, ...filters }) =>
      jsonResult(await request({
        path: `${REPORTING_BASE}/zero-search-results-keywords/source/${sourceKey}/export`,
        query: asQuery(filters),
      }))
  );
}
