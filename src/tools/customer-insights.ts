import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, REPORTING_BASE, REPORTING_DATE_FILTERS, READ_ONLY } from "./_shared.js";

const INSIGHTS_BASE = `${REPORTING_BASE}/customer-insights`;

/**
 * Date-only filter set for the customer-insights endpoints whose HAL query
 * template is `{?startDate,endDate}` (regions, editions, active-users).
 *
 * Verified 2026-06-03: these endpoints accept ONLY `startDate`/`endDate`.
 * Passing `productId` or `hosting` (which the generic `REPORTING_DATE_FILTERS`
 * carries) returns 200 but is silently ignored — so we don't expose them.
 * (`tiers` is the exception: it also accepts a `product` param — handled
 * separately when that tool is audited.)
 */
const INSIGHTS_DATE_FILTERS = {
  startDate: z.string().optional().describe("ISO date YYYY-MM-DD. Filters the monthly distribution buckets."),
  endDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
};

/**
 * Filter set for `customer_insights_tiers`, whose HAL template is
 * `{?startDate,endDate,product}`. The `product` param is special (verified
 * 2026-06-03): it filters by the **host application NAME** (e.g. "Jira",
 * "Confluence"), case-insensitive — NOT a productId UUID or vendor app key
 * (those return an empty result). When omitted, all host products are returned
 * and `usersPercent` sums to ~100% PER host product (so the grand total is
 * ~100 × number-of-host-products).
 */
const INSIGHTS_TIERS_FILTERS = {
  startDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
  endDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
  product: z.string().optional()
    .describe("Host application NAME — `jira` or `confluence` (case-insensitive). NOT a productId UUID or app key — anything else returns HTTP 400 'Must be a jira or confluence'. Omit to get all host products."),
};

function makeInsightTool(
  server: McpServer,
  suffix: string,
  name: string,
  description: string,
  filters: Record<string, z.ZodTypeAny> = REPORTING_DATE_FILTERS,
) {
  server.tool(name, description, filters, READ_ONLY, async (args) => {
    const data = await request({
      path: `${INSIGHTS_BASE}/${suffix}`,
      query: asQuery(args),
    });
    return jsonResult(data);
  });
}

// <auto-tsdoc-begin>
/**
 * Tool group registered from `customer-insights.ts` (4 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `customer_insights_regions` | `GET` | `/rest/3/reporting/developer-space/{developerId}/customer-insights/regions` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-regions-get) |
 * | `customer_insights_editions` | `GET` | `/rest/3/reporting/developer-space/{developerId}/customer-insights/editions` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-editions-get) |
 * | `customer_insights_tiers` | `GET` | `/rest/3/reporting/developer-space/{developerId}/customer-insights/tiers` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-tiers-get) |
 * | `customer_insights_active_users` | `GET` | `/rest/3/reporting/developer-space/{developerId}/customer-insights/active-users` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-active-users-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`customer_insights_regions`, `customer_insights_editions`, `customer_insights_tiers`, `customer_insights_active_users`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerCustomerInsightTools } from "./tools/customer-insights.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerCustomerInsightTools(server);
 * // Now these tools are live: `customer_insights_regions`, `customer_insights_editions`, `customer_insights_tiers`, …
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerCustomerInsightTools(server: McpServer): void {
  makeInsightTool(server, "regions", "customer_insights_regions",
    "Geographic-region distribution of your customers' users, per month. Returns `usersDistributionPerMonth[]`: each `{date, insightsType:[{value:{group:{region}, usersDistribution:{usersCount, usersPercent, usersMarketplaceBenchmark}}}]}`. Regions seen: apac, emea, americas, unknown. `usersPercent` sums to ~100 per month; `usersMarketplaceBenchmark` is the ecosystem comparison. Only startDate/endDate filter (productId/hosting are ignored by this endpoint).",
    INSIGHTS_DATE_FILTERS);
  makeInsightTool(server, "editions", "customer_insights_editions",
    "App-edition distribution of your customers' users, per month. Same shape as `customer_insights_regions` but grouped by `edition` ∈ {free, standard, premium, enterprise}. Each `{date, insightsType:[{value:{group:{edition}, usersDistribution:{usersCount, usersPercent, usersMarketplaceBenchmark}}}]}`. Only startDate/endDate filter (productId/hosting/product are ignored by this endpoint).",
    INSIGHTS_DATE_FILTERS);
  makeInsightTool(server, "tiers", "customer_insights_tiers",
    "User-tier distribution of your customers, per month, split by HOST PRODUCT. Group has TWO keys: `{product, tier}` where `product` is the host app (Jira/Confluence/…) and `tier` ∈ {Evaluation, 1-10, 11-100, 101-1000, 1000+}. Each `usersDistribution:{usersCount, usersPercent, usersMarketplaceBenchmark}`. `usersPercent` sums to ~100% PER host product (so ~200% across two products). Filter to one host with `product=Jira` (NAME, case-insensitive — not a UUID). startDate/endDate also filter; productId/hosting are ignored.",
    INSIGHTS_TIERS_FILTERS);
  makeInsightTool(server, "active-users", "customer_insights_active_users",
    "Paid-vs-non-paid active-user distribution across the customer base, per month. Group key `activeUsers` ∈ {paid, non-paid} (2 buckets, `usersPercent` sums to ~100). Each `usersDistribution:{usersCount, usersPercent, usersMarketplaceBenchmark}`. Only startDate/endDate filter (productId/hosting/product are ignored).",
    INSIGHTS_DATE_FILTERS);
}
