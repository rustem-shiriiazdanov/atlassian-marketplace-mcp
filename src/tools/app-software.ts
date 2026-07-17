import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, seg, READ_ONLY, DESTRUCTIVE } from "./_shared.js";

// <auto-tsdoc-begin>
/**
 * Tool group registered from `app-software.ts` (7 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `app_software_get_by_appkey` | `GET` | `/rest/3/app-software/app-key/{appKey}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-app-key-appkey-get) |
 * | `app_software_versions_list` | `GET` | `/rest/3/app-software/{appSoftwareId}/versions` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-get) |
 * | `app_software_version_create` | `POST` | `/rest/3/app-software/{appSoftwareId}/versions` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-post) |
 * | `app_software_version_get` | `GET` | `/rest/3/app-software/{appSoftwareId}/versions/{buildNumber}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-get) |
 * | `app_software_version_update` | `PUT` | `/rest/3/app-software/{appSoftwareId}/versions/{buildNumber}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-put) |
 * | `app_software_tokens_list` | `GET` | `/rest/3/app-software/{id}/tokens` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-id-tokens-get) |
 * | `app_software_token_create` | `POST` | `/rest/3/app-software/{id}/tokens` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-id-tokens-post) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`app_software_get_by_appkey`, `app_software_versions_list`, `app_software_version_create`, `app_software_version_get`, `app_software_version_update`, `app_software_tokens_list`, `app_software_token_create`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerAppSoftwareTools } from "./tools/app-software.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerAppSoftwareTools(server);
 * // Now these tools are live: `app_software_get_by_appkey`, `app_software_versions_list`, `app_software_version_create`, …
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerAppSoftwareTools(server: McpServer): void {
  server.tool(
    "app_software_get_by_appkey",
    "Look up app-software (the technical artifact behind a product listing) by its appKey. Returns an ARRAY of `{appSoftwareId, hosting, complianceBoundaries, archived}` — one entry per hosting platform the app supports. `complianceBoundaries` is a Cloud-only concept (an array like `[\"commercial\"]` for cloud, `null` for server/datacenter). Use `hosting` to narrow to a single entry.",
    {
      appKey: z.string().describe("App key like 'com.example.your-app'"),
      hosting: z.enum(["cloud", "server", "datacenter"]).optional()
        .describe("Narrow to one hosting platform's app-software entry. Invalid → HTTP 400."),
      complianceBoundaries: z.string().optional()
        .describe("Filter by compliance boundary (e.g. `commercial`)."),
    },
    READ_ONLY,
    async ({ appKey, ...filters }) =>
      jsonResult(await request({
        path: `/rest/3/app-software/app-key/${seg(appKey)}`,
        query: asQuery(filters),
      }))
  );

  server.tool(
    "app_software_versions_list",
    "List versions for an app-software. Returns `{links, versions:[{buildNumber, versionNumber, compatibilities, supportedPaymentModel, frameworkDetails, licenseType, ...}], totalCount}`. CURSOR-paginated (`limit`+`cursor` from `links.next`) — `offset` is NOT supported (silently ignored).",
    {
      appSoftwareId: z.string(),
      limit: z.number().int().min(1).max(50).optional().describe("Page size."),
      cursor: z.string().optional().describe("Opaque pagination token from `links.next`."),
      state: z.enum(["draft", "submitted", "approved", "auto-approved", "active", "rejected", "archived"]).optional()
        .describe("Filter by version state."),
      paymentModel: z.enum(["free", "paid-via-atlassian", "paid-via-vendor"]).optional()
        .describe("Filter by payment model. Invalid → HTTP 400."),
      parentSoftwareId: z.string().optional().describe("Filter by parent software (Atlassian product) id. Invalid → HTTP 400."),
      parentSoftwareVersionId: z.string().optional().describe("Filter by a specific parent-software version id."),
      afterVersion: z.string().optional().describe("Return versions after this version number."),
    },
    READ_ONLY,
    async ({ appSoftwareId, ...filters }) =>
      jsonResult(await request({
        path: `/rest/3/app-software/${seg(appSoftwareId)}/versions`,
        query: asQuery(filters),
      }))
  );

  server.tool(
    "app_software_version_create",
    "Create a new version for an app-software. PUBLIC IMPACT (eventually): once a version is approved and listing is published, customers can install it.",
    {
      appSoftwareId: z.string(),
      body: z.record(z.unknown()).describe("Version creation payload"),
    },
    DESTRUCTIVE,
    async ({ appSoftwareId, body }) => {
      const data = await request({
        method: "POST",
        path: `/rest/3/app-software/${seg(appSoftwareId)}/versions`,
        body,
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "app_software_version_get",
    "Get one version of an app-software by build number.",
    {
      appSoftwareId: z.string(),
      buildNumber: z.union([z.string(), z.number()]),
    },
    READ_ONLY,
    async ({ appSoftwareId, buildNumber }) =>
      jsonResult(await request({
        path: `/rest/3/app-software/${seg(appSoftwareId)}/versions/${seg(buildNumber)}`,
      }))
  );

  server.tool(
    "app_software_version_update",
    "Update one version of an app-software (PUT — full replace).",
    {
      appSoftwareId: z.string(),
      buildNumber: z.union([z.string(), z.number()]),
      body: z.record(z.unknown()),
    },
    DESTRUCTIVE,
    async ({ appSoftwareId, buildNumber, body }) => {
      await request({
        method: "PUT",
        path: `/rest/3/app-software/${seg(appSoftwareId)}/versions/${seg(buildNumber)}`,
        body,
      });
      return jsonResult({ ok: true, appSoftwareId, buildNumber });
    }
  );

  server.tool(
    "app_software_tokens_list",
    "List API access tokens minted for this app-software. Returns `{tokens:[{token, cloudId, instance}]}` — each token maps to one Cloud install. CREDENTIAL-ADJACENT: exposes token identifiers + the customer cloud sites they belong to.",
    {
      appSoftwareId: z.string(),
      token: z.string().optional().describe("Look up a specific token value (spec param; accepted, filters server-side)."),
    },
    READ_ONLY,
    async ({ appSoftwareId, ...filters }) =>
      jsonResult(await request({
        path: `/rest/3/app-software/${seg(appSoftwareId)}/tokens`,
        query: asQuery(filters),
      }))
  );

  server.tool(
    "app_software_token_create",
    "Create a new access token for this app-software. CREDENTIAL: the returned token must be stored securely — Atlassian will not show it again.",
    {
      appSoftwareId: z.string(),
      body: z.record(z.unknown()).optional().describe("Optional token-creation payload (scope, label, etc.)"),
    },
    DESTRUCTIVE,
    async ({ appSoftwareId, body }) => {
      const data = await request({
        method: "POST",
        path: `/rest/3/app-software/${seg(appSoftwareId)}/tokens`,
        body: body ?? {},
      });
      return jsonResult(data);
    }
  );
}
