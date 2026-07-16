import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { config } from "../config.js";
import { jsonResult, asQuery, READ_ONLY } from "./_shared.js";

interface AppListing {
  productId: string;
  appKey: string;
  appName: string;
  developerId: string;
  state?: string;
  approvalStatus?: string;
  slug?: string;
}

interface AppListingPage {
  items: AppListing[];
  links?: { self?: string; next?: string | null };
}

/** Extract the `cursor` query value from a HAL `next` href, if present. */
function nextCursor(links?: AppListingPage["links"]): string | null {
  const next = links?.next;
  if (!next) return null;
  const m = /[?&]cursor=([^&]+)/.exec(next);
  return m ? decodeURIComponent(m[1]) : null;
}

// <auto-tsdoc-begin>
/**
 * Tool group registered from `apps.ts` (2 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `apps_list` | `GET` | `/rest/3/product-listing/developer-space/{developerId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-developer-space-developerid-get) |
 * | `apps_known` | `GET` | `/rest/3/product-listing/developer-space/{developerId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-developer-space-developerid-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`apps_list`, `apps_known`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerAppTools } from "./tools/apps.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerAppTools(server);
 * // Now these tools are live: `apps_list`, `apps_known`
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerAppTools(server: McpServer): void {
  server.tool(
    "apps_list",
    "Discover apps in this developer space (live API call). Returns productId (UUID — use as filter), appKey, appName, state. CURSOR-paginated: pass `cursor` (from a prior response's `nextCursor`) to page forward. In summary mode the result includes `nextCursor` (null when no more pages). Default (no `limit`) returns up to 10 (the API's default page size).",
    {
      includeFullPayload: z.boolean().optional()
        .describe("If true, return the raw API response ({items, links}). Default false returns a compact summary + nextCursor."),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Page size. Omit for the API default (10). Cursor pagination — `offset` is not supported."),
      cursor: z.string().optional()
        .describe("Opaque pagination token from a prior response's `nextCursor` (summary mode) or `links.next` (full mode)."),
      includePrivate: z.boolean().optional()
        .describe("Include private (unlisted) apps in addition to public ones. Invalid value → HTTP 400."),
    },
    READ_ONLY,
    async ({ includeFullPayload, ...filters }) => {
      const data = await request<AppListingPage>({
        path: `/rest/3/product-listing/developer-space/${config.developerId}`,
        query: asQuery(filters),
      });
      if (includeFullPayload) return jsonResult(data);
      const summary = (data.items ?? []).map((a) => ({
        productId: a.productId,
        appKey: a.appKey,
        appName: a.appName,
        state: a.state,
        approvalStatus: a.approvalStatus,
      }));
      return jsonResult({ count: summary.length, apps: summary, nextCursor: nextCursor(data.links) });
    }
  );

  server.tool(
    "apps_known",
    "Return the static name -> productId map loaded from PRODUCT_ID_* env vars. Use this to look up product UUIDs by friendly name without an API call.",
    {},
    READ_ONLY,
    async () => jsonResult(config.knownProductIds)
  );
}
