import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, REPORTING_BASE, READ_ONLY, EXPORT_TIMEOUT_MS, exportAcceptHeader } from "./_shared.js";

// <auto-tsdoc-begin>
/**
 * Tool group registered from `free-starter.ts` (1 tool).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `free_starter_tier_export` | `GET` | `/rest/3/reporting/developer-space/{developerId}/sales/freeStarterTier/export` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-freestartertier-export-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`free_starter_tier_export`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerFreeStarterTools } from "./tools/free-starter.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerFreeStarterTools(server);
 * // Now this tool is live: `free_starter_tier_export`
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerFreeStarterTools(server: McpServer): void {
  server.tool(
    "free_starter_tier_export",
    "Export Cloud free-starter-tier entitlements (free users on your apps) as of a single date. Returns JSON array of `{day, licenseId, appEntitlementId, entitlementNumber, parentEdition, dateOfEvaluation, parentUnitCount, technicalEmail, vendorId, addonName, addonKey, productId}` by default; pass `accept=csv` for CSV. QUIRKS (Atlassian-side, verified 2026-06-03): (1) takes a SINGLE `date` snapshot — NOT a startDate/endDate range (ranges are silently ignored, yielding a future-dated default). (2) The CSV format OMITS the `productId` column that JSON includes (11 cols vs 12 keys). (3) A valid-shaped but non-existent `productId` returns HTTP 500 (not an empty result).",
    {
      date: z.string().optional()
        .describe("ISO date YYYY-MM-DD — the snapshot date. Omit for the API default (a future-dated default, so usually you want to set this)."),
      productId: z.string().optional()
        .describe("Product UUID — narrows the export to one app (verified: 263→50 rows, all matching)."),
      includeAtlassianLicenses: z.boolean().optional()
        .describe("Include internal Atlassian free-starter licenses in the export."),
      accept: z.enum(["csv", "json"]).optional()
        .describe("Output format: `json` (default — array of entitlement rows) or `csv`. Invalid → HTTP 400."),
    },
    READ_ONLY,
    async ({ accept, ...query }) =>
      jsonResult(await request({
        path: `${REPORTING_BASE}/sales/freeStarterTier/export`,
        query: asQuery({ ...query, accept }),
        accept: exportAcceptHeader(accept === "csv" ? "csv" : "json"),
        timeoutMs: EXPORT_TIMEOUT_MS,
      }))
  );
}
