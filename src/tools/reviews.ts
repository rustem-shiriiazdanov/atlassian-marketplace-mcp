import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, READ_ONLY, DESTRUCTIVE } from "./_shared.js";

// <auto-tsdoc-begin>
/**
 * Tool group registered from `reviews.ts` (4 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `reviews_list` | `GET` | `/rest/3/products/{productId}/reviews` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-get) |
 * | `review_get` | `GET` | `/rest/3/products/{productId}/reviews/{reviewId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-reviewid-get) |
 * | `review_response_put` | `PUT` | `/rest/3/products/{productId}/reviews/{reviewId}/response` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-reviewid-response-put) |
 * | `review_response_delete` | `DELETE` | `/rest/3/products/{productId}/reviews/{reviewId}/response` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-reviewid-response-delete) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`reviews_list`, `review_get`, `review_response_put`, `review_response_delete`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerReviewTools } from "./tools/reviews.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerReviewTools(server);
 * // Now these tools are live: `reviews_list`, `review_get`, `review_response_put`, …
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerReviewTools(server: McpServer): void {
  server.tool(
    "reviews_list",
    "List customer reviews for an app. CURSOR-paginated (not offset). Returns `{productId, reviews:[{id, content, stars, date, totalVotes, helpfulVotes, productHosting, isFlagged, authorName, transitionedToFiveStarRating}], cursor, count, averageStars}` where `count` is the total review count, `averageStars` the overall rating, and `cursor` the token for the next page. Pass `cursor` back to page forward. NOTE: reviews contain author names + free-text (PII).",
    {
      productId: z.string().describe("Product UUID (from apps_list / apps_known)."),
      hosting: z.enum(["cloud", "server", "datacenter"]).optional()
        .describe("Filter reviews by the reviewer's hosting platform. Narrows by each row's `productHosting`. Invalid value → HTTP 400."),
      sort: z.enum(["recent", "helpful", "highest_rated", "lowest_rated"]).optional()
        .describe("Sort order. `recent` (newest first), `helpful` (most helpful votes), `highest_rated`/`lowest_rated` (by stars). Invalid → HTTP 400. (The param is `sort` with these enum values — NOT `sortBy`/`order`, which are ignored.)"),
      limit: z.number().int().min(1).max(50).optional().describe("Page size (caps the `reviews[]` array)."),
      cursor: z.string().optional().describe("Opaque pagination token from a previous response's `cursor`. This endpoint is cursor-based — `offset` is NOT supported (silently ignored)."),
    },
    READ_ONLY,
    async ({ productId, ...filters }) =>
      jsonResult(await request({
        path: `/rest/3/products/${productId}/reviews`,
        query: asQuery(filters),
      }))
  );

  server.tool(
    "review_get",
    "Get a single review by ID.",
    {
      productId: z.string(),
      reviewId: z.string(),
    },
    READ_ONLY,
    async ({ productId, reviewId }) =>
      jsonResult(await request({
        path: `/rest/3/products/${productId}/reviews/${reviewId}`,
      }))
  );

  server.tool(
    "review_response_put",
    "Post or update a vendor response to a review. PUBLIC IMPACT: response is visible to all Marketplace visitors.",
    {
      productId: z.string(),
      reviewId: z.string(),
      response: z.string().describe("Response text body"),
    },
    DESTRUCTIVE,
    async ({ productId, reviewId, response }) => {
      await request({
        method: "PUT",
        path: `/rest/3/products/${productId}/reviews/${reviewId}/response`,
        body: { response },
      });
      return jsonResult({ ok: true, productId, reviewId });
    }
  );

  server.tool(
    "review_response_delete",
    "Delete the vendor's response to a review. PUBLIC IMPACT: removes a publicly visible response.",
    {
      productId: z.string(),
      reviewId: z.string(),
    },
    DESTRUCTIVE,
    async ({ productId, reviewId }) => {
      await request({
        method: "DELETE",
        path: `/rest/3/products/${productId}/reviews/${reviewId}/response`,
      });
      return jsonResult({ ok: true });
    }
  );
}
