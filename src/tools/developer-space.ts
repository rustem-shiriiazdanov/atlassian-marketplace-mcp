import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, READ_ONLY, DESTRUCTIVE } from "./_shared.js";
import { config } from "../config.js";

// <auto-tsdoc-begin>
/**
 * Tool group registered from `developer-space.ts` (9 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `developer_space_by_vendor` | `GET` | `/rest/3/developer-space/vendor/{vendorId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-vendor-vendorid-get) |
 * | `developer_space_get` | `GET` | `/rest/3/developer-space/{developerId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-get) |
 * | `developer_space_catalog_account` | `GET` | `/rest/3/developer-space/{developerId}/catalog-account` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-catalog-account-get) |
 * | `developer_space_listings` | `GET` | `/rest/3/developer-space/{developerId}/listings` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-listings-get) |
 * | `developer_space_members_list` | `GET` | `/rest/3/developer-space/{developerId}/members?limit={limit}&cursor={cursor}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-limit-limit-cursor-cursor-get) |
 * | `developer_space_member_get` | `GET` | `/rest/3/developer-space/{developerId}/members/{aaid}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-aaid-get) |
 * | `developer_space_member_add` | `POST` | `/rest/3/developer-space/{developerId}/members/{aaid}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-aaid-post) |
 * | `developer_space_member_update` | `PUT` | `/rest/3/developer-space/{developerId}/members/{aaid}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-aaid-put) |
 * | `developer_space_member_remove` | `DELETE` | `/rest/3/developer-space/{developerId}/members/{aaid}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-aaid-delete) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`developer_space_by_vendor`, `developer_space_get`, `developer_space_catalog_account`, `developer_space_listings`, `developer_space_members_list`, `developer_space_member_get`, `developer_space_member_add`, `developer_space_member_update`, `developer_space_member_remove`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerDeveloperSpaceTools } from "./tools/developer-space.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerDeveloperSpaceTools(server);
 * // Now these tools are live: `developer_space_by_vendor`, `developer_space_get`, `developer_space_catalog_account`, …
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerDeveloperSpaceTools(server: McpServer): void {
  server.tool(
    "developer_space_by_vendor",
    "Resolve a developerId from a vendorId (legacy mapping).",
    { vendorId: z.string() },
    READ_ONLY,
    async ({ vendorId }) =>
      jsonResult(await request({ path: `/rest/3/developer-space/vendor/${vendorId}` }))
  );

  server.tool(
    "developer_space_get",
    "Get developer space profile by developerId. Returns `{id, vendorId, name, status, type, organisationId, version}`. Defaults to MARKETPLACE_DEVELOPER_ID. Unknown/malformed id → HTTP 400.",
    {
      developerId: z.string().optional().default(config.developerId)
        .describe("Defaults to MARKETPLACE_DEVELOPER_ID"),
    },
    READ_ONLY,
    async ({ developerId }) =>
      jsonResult(await request({ path: `/rest/3/developer-space/${developerId}` }))
  );

  server.tool(
    "developer_space_catalog_account",
    "Get the catalog-account ID for a developer space (used by some downstream services).",
    {
      developerId: z.string().optional().default(config.developerId),
    },
    READ_ONLY,
    async ({ developerId }) =>
      jsonResult(await request({
        path: `/rest/3/developer-space/${developerId}/catalog-account`,
      }))
  );

  server.tool(
    "developer_space_listings",
    "Get the developer-profile listing documents (developer profile copy, web metadata, etc.). Returns a bare ARRAY of listing objects (not an envelope). NOT the product apps — use apps_list for those.",
    {
      developerId: z.string().optional().default(config.developerId),
    },
    READ_ONLY,
    async ({ developerId }) =>
      jsonResult(await request({
        path: `/rest/3/developer-space/${developerId}/listings`,
      }))
  );

  server.tool(
    "developer_space_members_list",
    "List team members in the developer space. Returns `{members:[{aaid, roles, categories, email, userName}], next}`. CURSOR-paginated, but with a NON-STANDARD shape (unlike the `links.next` URL used by other list tools): `next` is a BARE opaque cursor token (or absent on the last page) — pass its value straight back as the `cursor` param to get the following page. Page size via `limit` (default 10, max 50).",
    {
      developerId: z.string().optional().default(config.developerId),
      cursor: z.string().optional().describe("Opaque token from the previous response's top-level `next` field (a bare token, NOT a URL)."),
      limit: z.number().int().min(1).max(50).optional().describe("Page size (default 10, max 50)."),
    },
    READ_ONLY,
    async ({ developerId, ...filters }) =>
      jsonResult(await request({
        path: `/rest/3/developer-space/${developerId}/members`,
        query: asQuery(filters),
      }))
  );

  server.tool(
    "developer_space_member_get",
    "Get one developer-space team member by Atlassian account id (aaid). Returns `{aaid, roles, categories, email, userName}` — contains PII (email, userName). Unknown aaid → HTTP 400.",
    {
      developerId: z.string().optional().default(config.developerId),
      aaid: z.string().describe("Atlassian account ID"),
    },
    READ_ONLY,
    async ({ developerId, aaid }) =>
      jsonResult(await request({
        path: `/rest/3/developer-space/${developerId}/members/${aaid}`,
      }))
  );

  server.tool(
    "developer_space_member_add",
    "Add a user to the developer space. AFFECTS OTHERS: grants console access to this user.",
    {
      developerId: z.string().optional().default(config.developerId),
      aaid: z.string(),
      body: z.record(z.unknown()).optional().describe("Optional payload (role, etc.)"),
    },
    DESTRUCTIVE,
    async ({ developerId, aaid, body }) => {
      await request({
        method: "POST",
        path: `/rest/3/developer-space/${developerId}/members/${aaid}`,
        body: body ?? {},
      });
      return jsonResult({ ok: true, aaid });
    }
  );

  server.tool(
    "developer_space_member_update",
    "Update a developer-space team member (PUT — full replace).",
    {
      developerId: z.string().optional().default(config.developerId),
      aaid: z.string(),
      body: z.record(z.unknown()),
    },
    DESTRUCTIVE,
    async ({ developerId, aaid, body }) => {
      await request({
        method: "PUT",
        path: `/rest/3/developer-space/${developerId}/members/${aaid}`,
        body,
      });
      return jsonResult({ ok: true, aaid });
    }
  );

  server.tool(
    "developer_space_member_remove",
    "Remove a user from the developer space. AFFECTS OTHERS: revokes their console access.",
    {
      developerId: z.string().optional().default(config.developerId),
      aaid: z.string(),
    },
    DESTRUCTIVE,
    async ({ developerId, aaid }) => {
      await request({
        method: "DELETE",
        path: `/rest/3/developer-space/${developerId}/members/${aaid}`,
      });
      return jsonResult({ ok: true, aaid });
    }
  );
}
