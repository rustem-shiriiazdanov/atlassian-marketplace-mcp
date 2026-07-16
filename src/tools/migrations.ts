import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, READ_ONLY, DESTRUCTIVE } from "./_shared.js";

// <auto-tsdoc-begin>
/**
 * Tool group registered from `migrations.ts` (3 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `cloud_migration_compat_get` | `GET` | `/rest/3/cloud-migration-compatibility/products/{productId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-migrations/#api-rest-3-cloud-migration-compatibility-products-productid-get) |
 * | `cloud_migration_compat_create` | `PUT` | `/rest/3/cloud-migration-compatibility/products/{productId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-migrations/#api-rest-3-cloud-migration-compatibility-products-productid-put) |
 * | `cloud_migration_compat_update` | `PATCH` | `/rest/3/cloud-migration-compatibility/products/{productId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-migrations/#api-rest-3-cloud-migration-compatibility-products-productid-patch) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`cloud_migration_compat_get`, `cloud_migration_compat_create`, `cloud_migration_compat_update`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerMigrationTools } from "./tools/migrations.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerMigrationTools(server);
 * // Now these tools are live: `cloud_migration_compat_get`, `cloud_migration_compat_create`, `cloud_migration_compat_update`
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerMigrationTools(server: McpServer): void {
  server.tool(
    "cloud_migration_compat_get",
    "Get DC-to-Cloud migration compatibility info for an app. Returns `{developerId, productId, addonKey, addonName, cloudMigrationAssistantCompatibility, migrationPath, isDualLicenseOptedIn}`. NOTE: returns HTTP 404 (surfaced as an error) for apps that have no migration-compatibility record configured — not every app has one. No query params; productId is a path segment.",
    { productId: z.string().describe("Product UUID (path segment).") },
    READ_ONLY,
    async ({ productId }) =>
      jsonResult(await request({
        path: `/rest/3/cloud-migration-compatibility/products/${productId}`,
      }))
  );

  server.tool(
    "cloud_migration_compat_create",
    "Create cloud-migration compatibility info for an app. PUT semantics — body is the full document.",
    {
      productId: z.string(),
      body: z.record(z.unknown()).describe("Migration compatibility payload"),
    },
    DESTRUCTIVE,
    async ({ productId, body }) => {
      await request({
        method: "PUT",
        path: `/rest/3/cloud-migration-compatibility/products/${productId}`,
        body,
      });
      return jsonResult({ ok: true, productId });
    }
  );

  server.tool(
    "cloud_migration_compat_update",
    "Patch cloud-migration compatibility info (partial update).",
    {
      productId: z.string(),
      body: z.record(z.unknown()).describe("Partial migration compatibility payload"),
    },
    DESTRUCTIVE,
    async ({ productId, body }) => {
      await request({
        method: "PATCH",
        path: `/rest/3/cloud-migration-compatibility/products/${productId}`,
        body,
      });
      return jsonResult({ ok: true, productId });
    }
  );
}
