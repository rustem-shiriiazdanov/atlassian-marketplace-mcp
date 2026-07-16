import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, READ_ONLY, DESTRUCTIVE } from "./_shared.js";

// <auto-tsdoc-begin>
/**
 * Tool group registered from `app-version-listing.ts` (4 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `app_version_listings_list_all` | `GET` | `/rest/3/app-software/{appSoftwareId}/listings/all` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-version-listing/#api-rest-3-app-software-appsoftwareid-listings-all-get) |
 * | `app_version_listing_get` | `GET` | `/rest/3/app-software/{appSoftwareId}/versions/{buildNumber}/listing` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-version-listing/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-listing-get) |
 * | `app_version_listing_create` | `POST` | `/rest/3/app-software/{appSoftwareId}/versions/{buildNumber}/listing` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-version-listing/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-listing-post) |
 * | `app_version_listing_update` | `PUT` | `/rest/3/app-software/{appSoftwareId}/versions/{buildNumber}/listing` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-version-listing/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-listing-put) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`app_version_listings_list_all`, `app_version_listing_get`, `app_version_listing_create`, `app_version_listing_update`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerAppVersionListingTools } from "./tools/app-version-listing.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerAppVersionListingTools(server);
 * // Now these tools are live: `app_version_listings_list_all`, `app_version_listing_get`, `app_version_listing_create`, …
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerAppVersionListingTools(server: McpServer): void {
  server.tool(
    "app_version_listings_list_all",
    "List version-listings for an app-software (per-version published metadata: screenshots, highlights, moreDetails, youtubeId, developerLinks, approvalStatus, state, buildNumber, revision). Returns `{links, versions:[…]}`. Despite the name, it's CURSOR-paginated (default 10/page; pass `cursor` from `links.next`). Filter by `state` (PRIVATE/PUBLIC) and `approvalStatus` (both verified to narrow at the payload level; an unknown value returns an empty list, not an error).",
    {
      appSoftwareId: z.string(),
      limit: z.number().int().min(1).max(50).optional().describe("Page size (default 10)."),
      cursor: z.string().optional().describe("Opaque pagination token from `links.next`."),
      state: z.enum(["PRIVATE", "PUBLIC"]).optional()
        .describe("Filter by listing visibility state."),
      approvalStatus: z.enum(["APPROVED", "SUBMITTED", "REJECTED", "UNINITIATED"]).optional()
        .describe("Filter by Marketplace approval status."),
    },
    READ_ONLY,
    async ({ appSoftwareId, ...filters }) =>
      jsonResult(await request({
        path: `/rest/3/app-software/${appSoftwareId}/listings/all`,
        query: asQuery(filters),
      }))
  );

  server.tool(
    "app_version_listing_get",
    "Get the version-listing for a specific build number.",
    {
      appSoftwareId: z.string(),
      buildNumber: z.union([z.string(), z.number()]),
    },
    READ_ONLY,
    async ({ appSoftwareId, buildNumber }) =>
      jsonResult(await request({
        path: `/rest/3/app-software/${appSoftwareId}/versions/${buildNumber}/listing`,
      }))
  );

  server.tool(
    "app_version_listing_create",
    "Create a new version-listing for a specific build. PUBLIC IMPACT (after approval): publishes a new app version to the Marketplace.",
    {
      appSoftwareId: z.string(),
      buildNumber: z.union([z.string(), z.number()]),
      body: z.record(z.unknown()).describe("Version listing payload"),
    },
    DESTRUCTIVE,
    async ({ appSoftwareId, buildNumber, body }) => {
      const data = await request({
        method: "POST",
        path: `/rest/3/app-software/${appSoftwareId}/versions/${buildNumber}/listing`,
        body,
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "app_version_listing_update",
    "Update an existing version-listing (PUT — full replace). PUBLIC IMPACT: changes the customer-facing version metadata after approval.",
    {
      appSoftwareId: z.string(),
      buildNumber: z.union([z.string(), z.number()]),
      body: z.record(z.unknown()),
    },
    DESTRUCTIVE,
    async ({ appSoftwareId, buildNumber, body }) => {
      await request({
        method: "PUT",
        path: `/rest/3/app-software/${appSoftwareId}/versions/${buildNumber}/listing`,
        body,
      });
      return jsonResult({ ok: true, appSoftwareId, buildNumber });
    }
  );
}
