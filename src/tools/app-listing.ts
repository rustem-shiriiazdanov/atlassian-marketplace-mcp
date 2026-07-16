import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, READ_ONLY, DESTRUCTIVE } from "./_shared.js";

// <auto-tsdoc-begin>
/**
 * Tool group registered from `app-listing.ts` (2 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `app_listing_get` | `GET` | `/rest/3/product-listing/{productId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-productid-get) |
 * | `app_listing_update` | `PUT` | `/rest/3/product-listing/{productId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-productid-put) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`app_listing_get`, `app_listing_update`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerAppListingTools } from "./tools/app-listing.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerAppListingTools(server);
 * // Now these tools are live: `app_listing_get`, `app_listing_update`
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerAppListingTools(server: McpServer): void {
  server.tool(
    "app_listing_get",
    "Get Marketplace product listing metadata for one app. Returns `{productId, appKey, developerId, appName, summary, tagLine, images, tags, communityEnabled, developerLinks, thirdPartyIntegrations, state, approvalStatus, approvalDetails, slug, cloudComplianceBoundary, hostingVisibility, marketingLabels, revision, …}`. Unknown productId → HTTP 404.",
    { productId: z.string().describe("Product UUID") },
    READ_ONLY,
    async ({ productId }) =>
      jsonResult(await request({ path: `/rest/3/product-listing/${productId}` }))
  );

  server.tool(
    "app_listing_update",
    "Update Marketplace product listing metadata. PUBLIC IMPACT: changes appear on the app's marketplace page after approval. PUT semantics — body should be a full listing object.",
    {
      productId: z.string(),
      body: z.record(z.unknown()).describe("Full listing payload (matches the GET response shape)"),
    },
    DESTRUCTIVE,
    async ({ productId, body }) => {
      await request({
        method: "PUT",
        path: `/rest/3/product-listing/${productId}`,
        body,
      });
      return jsonResult({ ok: true, productId });
    }
  );
}
