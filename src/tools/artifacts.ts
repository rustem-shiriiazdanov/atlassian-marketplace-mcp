import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, seg, READ_ONLY, WRITE_SAFE } from "./_shared.js";

/**
 * Multipart binary upload endpoints (POST /artifacts, POST /assets/images/{imageType})
 * are deliberately not exposed — they require multipart/form-data which is awkward to
 * drive from an LLM. Use POST /artifacts/fetch with a URL instead.
 */

// <auto-tsdoc-begin>
/**
 * Tool group registered from `artifacts.ts` (2 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `artifact_fetch_from_url` | `POST` | `/rest/3/artifacts/fetch` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-assets/#api-rest-3-artifacts-fetch-post) |
 * | `artifact_get` | `GET` | `/rest/3/artifacts/{artifactId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-assets/#api-rest-3-artifacts-artifactid-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`artifact_fetch_from_url`, `artifact_get`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerArtifactTools } from "./tools/artifacts.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerArtifactTools(server);
 * // Now these tools are live: `artifact_fetch_from_url`, `artifact_get`
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerArtifactTools(server: McpServer): void {
  server.tool(
    "artifact_fetch_from_url",
    "Have Atlassian fetch an artifact from a public URL and store it. Returns `{fileInfo, _links, details}` — the stored artifact's id/download link live under `_links`/`fileInfo`. NOTE: the API field is `uri` (not `url`); this tool accepts `url` and maps it to `uri` for you.",
    {
      url: z.string().url().describe("Public URL of the artifact to fetch and store (sent to the API as the required `uri` field)."),
      // The fetch endpoint accepts additional metadata; pass through as body.
      extra: z.record(z.unknown()).optional()
        .describe("Optional extra fields to include in the fetch request body"),
    },
    WRITE_SAFE,
    async ({ url, extra }) => {
      // The API's required body field is `uri`, not `url`.
      const body = { uri: url, ...(extra ?? {}) };
      return jsonResult(await request({
        method: "POST",
        path: `/rest/3/artifacts/fetch`,
        body,
      }));
    }
  );

  server.tool(
    "artifact_get",
    "Get artifact metadata (name, size, content type, download URL).",
    { artifactId: z.string() },
    READ_ONLY,
    async ({ artifactId }) =>
      jsonResult(await request({ path: `/rest/3/artifacts/${seg(artifactId)}` }))
  );
}
