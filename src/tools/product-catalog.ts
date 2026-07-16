import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, READ_ONLY } from "./_shared.js";

// <auto-tsdoc-begin>
/**
 * Tool group registered from `product-catalog.ts` (1 tool).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `product_catalog_latest` | `GET` | `/rest/3/reporting/product-catalog/latest` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-product-catalog-latest-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`product_catalog_latest`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerProductCatalogTools } from "./tools/product-catalog.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerProductCatalogTools(server);
 * // Now this tool is live: `product_catalog_latest`
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerProductCatalogTools(server: McpServer): void {
  server.tool(
    "product_catalog_latest",
    "Get a presigned S3 URL for the latest public Marketplace app-catalog snapshot. Response shape: {date, presignedUrl, expiresInSeconds}. The presignedUrl points to a LARGE CSV file (~150 MB, Content-Type binary/octet-stream — NOT JSON), one row per published app with columns like: is_beta, summary, tag_line, is_connect, product_id, released_at, vendor_name, is_supported, review_score, average_stars, install_count, download_count, version_number, version_status, publicly_visible, number_of_reviews, category_name_list, marketplace_app_key, app_software_hosting. This is the whole public app marketplace (all vendors' apps), NOT your own apps or Atlassian's product/pricing structure. presignedUrl expires in ~300s — download promptly.",
    {},
    READ_ONLY,
    async () =>
      jsonResult(await request({ path: `/rest/3/reporting/product-catalog/latest` }))
  );
}
