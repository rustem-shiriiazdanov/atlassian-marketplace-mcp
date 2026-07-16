import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, REPORTING_BASE, READ_ONLY, WRITE_SAFE, EXPORT_TIMEOUT_MS } from "./_shared.js";

/**
 * Filters for the marketing-attribution export START. HAL template
 * `{?addon*,text,startDate,endDate}` (verified 2026-06-03). `productId`/`hosting`
 * are NOT in the template (productId returns 200 but isn't a documented filter
 * here — use `addon`). The export is param-deduped server-side: identical params
 * return the same `exportId`.
 */
const MARKETING_EXPORT_FILTERS = {
  productId: z.string().optional()
    .describe("Product UUID to scope the export to one app (verified: changes the exportId, so it affects the data)."),
  addon: z.string().optional()
    .describe("App key (e.g. `com.example.your-app`) to scope the export to one app."),
  text: z.string().optional()
    .describe("Free-text search filter applied to the exported attribution rows."),
  startDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
  endDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
  accept: z.enum(["csv", "json"]).optional()
    .describe("Format the eventual download produces (`csv`|`json`). The start response itself is always the `{export:{id}}` envelope."),
};

/**
 * Note: marketing-attribution status/download use the GENERIC async/export path
 * (no marketing-attribution prefix), unlike licenses/transactions.
 */

// <auto-tsdoc-begin>
/**
 * Tool group registered from `marketing-attribution.ts` (3 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `marketing_attribution_export_async_start` | `POST` | `/rest/3/reporting/developer-space/{developerId}/marketing-attribution/async/export` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-marketing-attribution-async-export-post) |
 * | `marketing_attribution_export_async_status` | `GET` | `/rest/3/reporting/developer-space/{developerId}/async/export/{exportId}/status` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-async-export-exportid-status-get) |
 * | `marketing_attribution_export_async_download` | `GET` | `/rest/3/reporting/developer-space/{developerId}/async/export/{exportId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-async-export-exportid-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`marketing_attribution_export_async_start`, `marketing_attribution_export_async_status`, `marketing_attribution_export_async_download`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerMarketingAttributionTools } from "./tools/marketing-attribution.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerMarketingAttributionTools(server);
 * // Now these tools are live: `marketing_attribution_export_async_start`, `marketing_attribution_export_async_status`, `marketing_attribution_export_async_download`
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerMarketingAttributionTools(server: McpServer): void {
  server.tool(
    "marketing_attribution_export_async_start",
    "Start an async export of marketing-attribution data. Returns `{export:{id}}` — pass that id to `marketing_attribution_export_async_status` then `_download`. Filters: productId/addon/text/startDate/endDate (+ `accept` for the eventual download format). Export is param-deduped: identical params yield the same exportId.",
    MARKETING_EXPORT_FILTERS,
    WRITE_SAFE,
    async (args) => {
      const data = await request({
        method: "POST",
        path: `${REPORTING_BASE}/marketing-attribution/async/export`,
        query: asQuery(args),
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "marketing_attribution_export_async_status",
    "Poll status of an async marketing-attribution export job. NOTE the generic /async/export/ path (shared, not prefixed).",
    { exportId: z.string() },
    READ_ONLY,
    async ({ exportId }) =>
      jsonResult(await request({
        path: `${REPORTING_BASE}/async/export/${exportId}/status`,
      }))
  );

  server.tool(
    "marketing_attribution_export_async_download",
    "Download a completed async marketing-attribution export. Returns JSON records. Request timeout is 10 min (overridable via EXPORT_TIMEOUT_MS env). Only call this after the *_status endpoint reports DONE — otherwise you'll get a 404 'Export is being processed'.",
    { exportId: z.string() },
    READ_ONLY,
    async ({ exportId }) =>
      jsonResult(await request({
        path: `${REPORTING_BASE}/async/export/${exportId}`,
        timeoutMs: EXPORT_TIMEOUT_MS,
      }))
  );
}
