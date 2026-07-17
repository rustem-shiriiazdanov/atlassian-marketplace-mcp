import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, seg, READ_ONLY } from "./_shared.js";

/** limit + cursor pagination shared by the parent-software list endpoints. */
const PS_PAGE = {
  limit: z.number().int().min(1).max(50).optional().describe("Page size. Omit to get the full default page."),
  cursor: z.string().optional().describe("Opaque pagination token from a prior response's `links.next`."),
};

// <auto-tsdoc-begin>
/**
 * Tool group registered from `parent-software.ts` (5 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `parent_software_list` | `GET` | `/rest/3/parent-software` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-get) |
 * | `parent_software_get` | `GET` | `/rest/3/parent-software/{parentSoftwareId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-parentsoftwareid-get) |
 * | `parent_software_versions_list` | `GET` | `/rest/3/parent-software/{parentSoftwareId}/versions` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-parentsoftwareid-versions-get) |
 * | `parent_software_version_by_build` | `GET` | `/rest/3/parent-software/{parentSoftwareId}/versions/build/{buildNumber}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-parentsoftwareid-versions-build-buildnumber-get) |
 * | `parent_software_version_by_number` | `GET` | `/rest/3/parent-software/{id}/versions/number/{versionNumber}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-id-versions-number-versionnumber-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`parent_software_list`, `parent_software_get`, `parent_software_versions_list`, `parent_software_version_by_build`, `parent_software_version_by_number`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerParentSoftwareTools } from "./tools/parent-software.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerParentSoftwareTools(server);
 * // Now these tools are live: `parent_software_list`, `parent_software_get`, `parent_software_versions_list`, …
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerParentSoftwareTools(server: McpServer): void {
  server.tool(
    "parent_software_list",
    "List parent software (the Atlassian products your apps target — Jira, Confluence, Bitbucket, etc.). Returns `{links, parentSoftware:[…]}`. CURSOR-paginated (`limit`+`cursor` from `links.next`); the default page returns all ~23 products.",
    PS_PAGE,
    READ_ONLY,
    async (args) =>
      jsonResult(await request({ path: `/rest/3/parent-software`, query: asQuery(args) }))
  );

  server.tool(
    "parent_software_get",
    "Get one parent software (Atlassian product) by ID (e.g. `jira`, `confluence`). Returns `{id, developerId:'Atlassian', name, hostingOptions:[{hosting}], extensibilityFrameworks, state, revision}`. Nonexistent id → HTTP 404.",
    { parentSoftwareId: z.string().describe("Parent-software id, e.g. `jira` (from parent_software_list).") },
    READ_ONLY,
    async ({ parentSoftwareId }) =>
      jsonResult(await request({
        path: `/rest/3/parent-software/${seg(parentSoftwareId)}`,
      }))
  );

  server.tool(
    "parent_software_versions_list",
    "List known versions of a parent software (e.g. Jira versions Atlassian has published). CURSOR-paginated (`limit`+`cursor` from `links.next`).",
    { parentSoftwareId: z.string(), ...PS_PAGE },
    READ_ONLY,
    async ({ parentSoftwareId, ...filters }) =>
      jsonResult(await request({
        path: `/rest/3/parent-software/${seg(parentSoftwareId)}/versions`,
        query: asQuery(filters),
      }))
  );

  server.tool(
    "parent_software_version_by_build",
    "Get a parent-software version by its build number (path `/versions/build/{buildNumber}`). Returns `{buildNumber, versionNumber, hosting:[…], state, revision, createdAt}`. Unknown build → HTTP 404.",
    {
      parentSoftwareId: z.string(),
      buildNumber: z.union([z.string(), z.number()]),
    },
    READ_ONLY,
    async ({ parentSoftwareId, buildNumber }) =>
      jsonResult(await request({
        // encode the segment — buildNumber is normally digits, but encode defensively.
        path: `/rest/3/parent-software/${seg(parentSoftwareId)}/versions/build/${seg(buildNumber)}`,
      }))
  );

  server.tool(
    "parent_software_version_by_number",
    "Get a parent-software version by its human-readable version number (path `/versions/number/{versionNumber}`, e.g. '11.3.8'). Same record shape as version_by_build (`{buildNumber, versionNumber, hosting, state, revision, createdAt}`). Unknown version → HTTP 404.",
    {
      parentSoftwareId: z.string(),
      versionNumber: z.string(),
    },
    READ_ONLY,
    async ({ parentSoftwareId, versionNumber }) =>
      jsonResult(await request({
        path: `/rest/3/parent-software/${seg(parentSoftwareId)}/versions/number/${seg(versionNumber)}`,
      }))
  );
}
