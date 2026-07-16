import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, READ_ONLY } from "./_shared.js";
import { config } from "../config.js";

// <auto-tsdoc-begin>
/**
 * Tool group registered from `partner-metrics.ts` (1 tool).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `partner_metrics_fetch` | `POST` | `/rest/3/partner-metrics/developer-space/{developerId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-partner-metrics-developer-space-developerid-post) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`partner_metrics_fetch`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerPartnerMetricsTools } from "./tools/partner-metrics.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerPartnerMetricsTools(server);
 * // Now this tool is live: `partner_metrics_fetch`
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerPartnerMetricsTools(server: McpServer): void {
  server.tool(
    "partner_metrics_fetch",
    "Fetch partner-metric time series (POST). The `body` shape is `ReportingMetricTimeSeriesRequestBody`: `{metrics:{metricSets:[…], metricFields:[…]}, dateRange:{startDate, endDate}, granularity:'YEAR'|'MONTH'|'WEEK'|'DAY', attributes?, sortByList?, attributeFilter?}`. IMPORTANT: `metrics` is an OBJECT (not an array) and `metricSets`/`metricFields` are arrays of OBJECTS; `dateRange` uses `startDate`/`endDate` (not start/end). A wrong shape returns HTTP 400 with a JSON-parse error message. `limit`/`offset` are query params for paging the result rows.",
    {
      developerId: z.string().optional().default(config.developerId),
      limit: z.number().int().min(1).optional().describe("Max result rows to return."),
      offset: z.number().int().min(0).optional().describe("Result-row offset for paging."),
      body: z.record(z.unknown()).describe("ReportingMetricTimeSeriesRequestBody — see the tool description for the required shape."),
    },
    READ_ONLY,
    async ({ developerId, body, ...query }) =>
      jsonResult(await request({
        method: "POST",
        path: `/rest/3/partner-metrics/developer-space/${developerId}`,
        query: asQuery(query),
        body,
      }))
  );
}
