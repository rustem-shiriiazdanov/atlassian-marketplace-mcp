import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, REPORTING_BASE, LICENSE_FILTERS, READ_ONLY, WRITE_SAFE, EXPORT_TIMEOUT_MS, ACCEPT_CSV_JSON, exportAcceptHeader } from "./_shared.js";

// <auto-tsdoc-begin>
/**
 * Tool group registered from `licenses.ts` (5 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `licenses_list` | `GET` | `/rest/3/reporting/developer-space/{developerId}/licenses` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-licenses-get) |
 * | `licenses_export_sync` | `GET` | `/rest/3/reporting/developer-space/{developerId}/licenses/export` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-licenses-export-get) |
 * | `licenses_export_async_start` | `POST` | `/rest/3/reporting/developer-space/{developerId}/licenses/async/export` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-licenses-async-export-post) |
 * | `licenses_export_async_status` | `GET` | `/rest/3/reporting/developer-space/{developerId}/licenses/async/export/{exportId}/status` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-licenses-async-export-exportid-status-get) |
 * | `licenses_export_async_download` | `GET` | `/rest/3/reporting/developer-space/{developerId}/licenses/async/export/{exportId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-licenses-async-export-exportid-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`licenses_list`, `licenses_export_sync`, `licenses_export_async_start`, `licenses_export_async_status`, `licenses_export_async_download`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerLicenseTools } from "./tools/licenses.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerLicenseTools(server);
 * // Now these tools are live: `licenses_list`, `licenses_export_sync`, `licenses_export_async_start`, …
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerLicenseTools(server: McpServer): void {
  server.tool(
    "licenses_list",
    "List licenses for the developer space (paginated, offset/limit). Use 'text' to find a single license by SEN.",
    LICENSE_FILTERS,
    READ_ONLY,
    async (args) => {
      const data = await request({
        path: `${REPORTING_BASE}/licenses`,
        query: asQuery(args),
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "licenses_export_sync",
    "Synchronous export of licenses. `accept=csv` (default) returns a CSV string; `accept=json` returns a JSON array. May 5xx on large ranges — prefer the async variant. Request timeout is bumped to 10 min (overridable via EXPORT_TIMEOUT_MS env).",
    { ...LICENSE_FILTERS, ...ACCEPT_CSV_JSON },
    READ_ONLY,
    async (args) => {
      const data = await request({
        path: `${REPORTING_BASE}/licenses/export`,
        query: asQuery(args),
        accept: exportAcceptHeader(args.accept),
        timeoutMs: EXPORT_TIMEOUT_MS,
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "licenses_export_async_start",
    "Start an async license export job. Returns `{export:{id}}` to poll. `accept=csv|json` sets the format the eventual download will produce (the start response itself is always the id envelope).",
    { ...LICENSE_FILTERS, ...ACCEPT_CSV_JSON },
    WRITE_SAFE,
    async (args) => {
      const data = await request({
        method: "POST",
        path: `${REPORTING_BASE}/licenses/async/export`,
        query: asQuery(args),
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "licenses_export_async_status",
    "Poll status of an async license export job.",
    { exportId: z.string() },
    READ_ONLY,
    async ({ exportId }) =>
      jsonResult(
        await request({
          path: `${REPORTING_BASE}/licenses/async/export/${exportId}/status`,
        })
      )
  );

  server.tool(
    "licenses_export_async_download",
    "Download a completed async license export. Returns the JSON array of license records. Request timeout is 10 min (overridable via EXPORT_TIMEOUT_MS env) so multi-MB downloads don't get aborted mid-stream. Only call this after the *_status endpoint reports DONE — otherwise you'll get a 404 'Export is being processed'.",
    { exportId: z.string() },
    READ_ONLY,
    async ({ exportId }) =>
      jsonResult(
        await request({
          path: `${REPORTING_BASE}/licenses/async/export/${exportId}`,
          timeoutMs: EXPORT_TIMEOUT_MS,
        })
      )
  );
}
