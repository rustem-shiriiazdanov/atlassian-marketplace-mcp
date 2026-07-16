import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, REPORTING_BASE, READ_ONLY } from "./_shared.js";

/**
 * Filter set for the two benchmark endpoints. HAL template `{?addon*,startDate,endDate}`
 * PLUS `productId` (works despite being absent from the template — verified
 * 2026-06-03, narrows to one app). `hosting` and `aggregation` are silently
 * ignored (these are always per-month, all-hosting benchmarks).
 */
const BENCHMARK_FILTERS = {
  productId: z.string().optional()
    .describe("Product UUID. Narrows to one app. (Not in the HAL template but works.)"),
  addon: z.string().optional()
    .describe("App key (e.g. `com.example.your-app`). Narrows to one app. Alternative to `productId`."),
  startDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
  endDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
};

// <auto-tsdoc-begin>
/**
 * Tool group registered from `benchmarks.ts` (2 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `benchmark_sales` | `GET` | `/rest/3/reporting/developer-space/{developerId}/benchmark/sales` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-benchmark-sales-get) |
 * | `benchmark_evaluations` | `GET` | `/rest/3/reporting/developer-space/{developerId}/benchmark/evaluations` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-benchmark-evaluations-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`benchmark_sales`, `benchmark_evaluations`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerBenchmarkTools } from "./tools/benchmarks.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerBenchmarkTools(server);
 * // Now these tools are live: `benchmark_sales`, `benchmark_evaluations`
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerBenchmarkTools(server: McpServer): void {
  server.tool(
    "benchmark_sales",
    "Sales benchmark vs. ecosystem, per month. Returns `{total:{name, salesBenchmarkPerMonth:[…]}, addons:[{addonKey, name, productId, salesBenchmarkPerMonth}]}`. Each month row: `{date, sale, previousMonthSale, salesMoMGrowth, salesPercentile, salesMoMGrowthBenchmarkAllPartners, salesYTD, salesYTDLastYear, salesYTDYoYGrowth, salesYTDPercentile, salesYTDYoYGrowthBenchmarkAllPartners}`. `*Percentile` is your rank vs all partners; `*BenchmarkAllPartners` is the ecosystem figure. Filter by addon (app key) or productId; hosting/aggregation are ignored.",
    BENCHMARK_FILTERS,
    READ_ONLY,
    async (args) =>
      jsonResult(await request({
        path: `${REPORTING_BASE}/benchmark/sales`,
        query: asQuery(args),
      }))
  );

  server.tool(
    "benchmark_evaluations",
    "Evaluations benchmark vs. ecosystem, per month. Returns `{totals:{name, evaluationBenchmarkPerVendorPerMonth:[…]}, addons:[{addonKey, name, productId, evaluationBenchmarkPerAppPerMonth}]}`. NOTE the wrapper is `totals` (plural) and the per-month key differs between total level (`…PerVendorPerMonth`) and addon level (`…PerAppPerMonth`). Each month row: `{date, evaluationCount, previousMonthEvaluationCount, evaluationMoMGrowth, evaluationPercentile, evaluationMoMGrowthBenchmarkAllPartners, evaluationCountYTD, evaluationCountYTDLastYear, evaluationYTDYoYGrowth, evaluationYTDPercentile, evaluationYTDYoYGrowthBenchmarkAllPartners}`. Filter by addon/productId; hosting/aggregation ignored.",
    BENCHMARK_FILTERS,
    READ_ONLY,
    async (args) =>
      jsonResult(await request({
        path: `${REPORTING_BASE}/benchmark/evaluations`,
        query: asQuery(args),
      }))
  );
}
