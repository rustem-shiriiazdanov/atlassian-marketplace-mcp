import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, REPORTING_BASE, READ_ONLY } from "./_shared.js";

/**
 * Filters for `app_requests_and_approvals`. HAL template `{?addon*,startDate,endDate}`
 * PLUS `productId` (works — narrows to one app, verified 2026-06-03). It's a
 * benchmark-style `{total, addons}` aggregate (NOT a paginated list), so
 * `offset`/`limit`/`sortBy`/`order` and `hosting` are all silently ignored.
 */
const APP_REQUESTS_FILTERS = {
  productId: z.string().optional()
    .describe("Product UUID. Narrows to one app. (Not in the HAL template but works.)"),
  addon: z.string().optional()
    .describe("App key (e.g. `com.example.your-app`). Narrows to one app. Alternative to `productId`."),
  startDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
  endDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
};

// <auto-tsdoc-begin>
/**
 * Tool group registered from `app-requests.ts` (1 tool).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `app_requests_and_approvals` | `GET` | `/rest/3/reporting/developer-space/{developerId}/app-requests-and-approvals` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-app-requests-and-approvals-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`app_requests_and_approvals`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerAppRequestTools } from "./tools/app-requests.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerAppRequestTools(server);
 * // Now this tool is live: `app_requests_and_approvals`
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerAppRequestTools(server: McpServer): void {
  server.tool(
    "app_requests_and_approvals",
    "Marketplace 'request app' / 'approve app' activity, per month. Benchmark-style aggregate (NOT a paginated list): `{total:{name, appRequestsAndApprovalsPerMonth:[{date, appRequests, appRequestsApproved, appRequestsApprovalRate}]}, addons:[{addonKey, name, productId, appRequestsAndApprovalsPerAppPerMonth}]}`. Filter by addon (app key) or productId; hosting/pagination are silently ignored.",
    APP_REQUESTS_FILTERS,
    READ_ONLY,
    async (args) =>
      jsonResult(await request({
        path: `${REPORTING_BASE}/app-requests-and-approvals`,
        query: asQuery(args),
      }))
  );
}
