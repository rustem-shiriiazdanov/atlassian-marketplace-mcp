import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, REPORTING_BASE, READ_ONLY } from "./_shared.js";

// <auto-tsdoc-begin>
/**
 * Tool group registered from `evaluations.ts` (1 tool).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `evaluations_by_metric` | `GET` | `/rest/3/reporting/developer-space/{developerId}/evaluations/{metric}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-evaluations-metric-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`evaluations_by_metric`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerEvaluationTools } from "./tools/evaluations.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerEvaluationTools(server);
 * // Now this tool is live: `evaluations_by_metric`
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerEvaluationTools(server: McpServer): void {
  server.tool(
    "evaluations_by_metric",
    "Evaluation time-series grouped by a dimension. FLAT `total.series[]` (no datasets, no uniqueTotal) — one series per group value (e.g. country names for `metric=country`), each `{name, elements:[{date,count}]}` — plus per-app `addons[]`. Only aggregation/startDate/endDate filter (productId/hosting/addon are silently ignored on this endpoint).",
    {
      metric: z.enum(["country", "hosting", "partner", "region"])
        .describe("Path segment / grouping dimension. Allowable per Atlassian: `country`, `hosting`, `partner`, `region`. Anything else → HTTP 400."),
      aggregation: z.enum(["week", "month"]).optional()
        .describe("Time-series bucket cadence. Default week. Invalid → 400."),
      startDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
      endDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
    },
    READ_ONLY,
    async ({ metric, ...filters }) => {
      const data = await request({
        path: `${REPORTING_BASE}/evaluations/${metric}`,
        query: asQuery(filters),
      });
      return jsonResult(data);
    }
  );
}
