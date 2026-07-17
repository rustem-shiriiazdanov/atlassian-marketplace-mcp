import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, seg, READ_ONLY, DESTRUCTIVE } from "./_shared.js";

// <auto-tsdoc-begin>
/**
 * Tool group registered from `privacy-security.ts` (4 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `privacy_security_get` | `GET` | `/rest/3/privacy-and-security/products/{productId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-get) |
 * | `privacy_security_draft_put` | `PUT` | `/rest/3/privacy-and-security/products/{productId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-put) |
 * | `privacy_security_draft_delete` | `DELETE` | `/rest/3/privacy-and-security/products/{productId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-delete) |
 * | `privacy_security_publish` | `POST` | `/rest/3/privacy-and-security/products/{productId}/publish` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-publish-post) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`privacy_security_get`, `privacy_security_draft_put`, `privacy_security_draft_delete`, `privacy_security_publish`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerPrivacySecurityTools } from "./tools/privacy-security.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerPrivacySecurityTools(server);
 * // Now these tools are live: `privacy_security_get`, `privacy_security_draft_put`, `privacy_security_draft_delete`, …
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerPrivacySecurityTools(server: McpServer): void {
  server.tool(
    "privacy_security_get",
    "Get privacy & security information for an app (used by enterprise procurement reviewers). Returns `{commonCloud:{dataAccessAndStorage, logDetails, dataResidency, privacy, security, properties, hasRestAPIExtension, supportsConfigurableEgress}}`. `state=live` (default) returns the published version; `state=draft` the unpublished draft (404 if none exists). Invalid state → HTTP 400.",
    {
      productId: z.string(),
      state: z.enum(["live", "draft"]).optional()
        .describe("Which version to fetch: `live` (published, default) or `draft` (unpublished). Invalid → HTTP 400; `draft` → 404 if none exists."),
    },
    READ_ONLY,
    async ({ productId, ...filters }) =>
      jsonResult(await request({
        path: `/rest/3/privacy-and-security/products/${seg(productId)}`,
        query: asQuery(filters),
      }))
  );

  server.tool(
    "privacy_security_draft_put",
    "Create or update the draft privacy-and-security information (not yet public). PUT — full replace.",
    {
      productId: z.string(),
      body: z.record(z.unknown()).describe("Full privacy-and-security payload"),
    },
    DESTRUCTIVE,
    async ({ productId, body }) => {
      await request({
        method: "PUT",
        path: `/rest/3/privacy-and-security/products/${seg(productId)}`,
        body,
      });
      return jsonResult({ ok: true, productId });
    }
  );

  server.tool(
    "privacy_security_draft_delete",
    "Delete the draft privacy-and-security info (the currently published version is unaffected).",
    { productId: z.string() },
    DESTRUCTIVE,
    async ({ productId }) => {
      await request({
        method: "DELETE",
        path: `/rest/3/privacy-and-security/products/${seg(productId)}`,
      });
      return jsonResult({ ok: true, productId });
    }
  );

  server.tool(
    "privacy_security_publish",
    "Publish the current draft privacy-and-security info. PUBLIC IMPACT: this version becomes visible to all Marketplace visitors and procurement reviewers.",
    { productId: z.string() },
    DESTRUCTIVE,
    async ({ productId }) => {
      await request({
        method: "POST",
        path: `/rest/3/privacy-and-security/products/${seg(productId)}/publish`,
      });
      return jsonResult({ ok: true, productId });
    }
  );
}
