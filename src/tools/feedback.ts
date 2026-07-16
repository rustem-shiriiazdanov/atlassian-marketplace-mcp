import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, REPORTING_BASE, READ_ONLY } from "./_shared.js";

/**
 * Filter set for `feedback_details`. Per the HAL query template
 * `{?type*,anonymous,reason*,addon*,hosting*,startDate,endDate,text,offset,limit}`
 * PLUS `productId` (works despite being absent from the template — verified
 * 2026-06-03, all returned rows matched the productId).
 *
 * NOT accepted (silently ignored): `sortBy`, `order`.
 *
 * Verified filter behavior (2026-06-03):
 * - `type` strict enum → `uninstall` | `disable` | `unsubscribe` (invalid → 400 "ChurnType: allowable values …").
 * - `reason` filters by `reasonKey`; observed keys: bugs, merging, not-meeting-needs, other, project-based, sandbox, usefulness.
 * - `anonymous` boolean: `true` ⇒ rows have empty `fullName`; `false` ⇒ fullName present. Invalid value → 400 "Type mismatch".
 * - `addon` (app key) and `productId` (UUID) both narrow to one app.
 * - `text` free-text search across the feedback message/identifiers.
 */
const FEEDBACK_DETAILS_FILTERS = {
  productId: z.string().optional()
    .describe("Product UUID. Narrows to one app. (Not in the HAL template but works.) Prefer this or `addon`, not both."),
  addon: z.string().optional()
    .describe("App key (e.g. `com.example.your-app`). Narrows to one app. Alternative to `productId`."),
  type: z.enum(["uninstall", "disable", "unsubscribe"]).optional()
    .describe("Feedback event type (maps to response `feedbackType`). Strict enum — invalid → HTTP 400."),
  reason: z.string().optional()
    .describe("Filter by `reasonKey`. Observed values: bugs, merging, not-meeting-needs, other, project-based, sandbox, usefulness."),
  hosting: z.enum(["cloud", "datacenter", "server"]).optional()
    .describe("Filter by hosting. Response uses 'Cloud'/'Server'/'Data Center'."),
  appEdition: z.enum(["free", "standard", "advanced"]).optional()
    .describe("Filter by app edition (free/standard/advanced) — documented in the spec + verified to narrow (2026-06-03)."),
  anonymous: z.boolean().optional()
    .describe("`true` returns only anonymized feedback (empty `fullName`); `false` only attributed. Invalid value → 400."),
  text: z.string().optional()
    .describe("Free-text search across the feedback message and identifiers."),
  startDate: z.string().optional().describe("ISO date YYYY-MM-DD (filters by feedback date)."),
  endDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(50).optional().describe("Max 50 (server cap). `_links.next` carries the next page."),
};

// <auto-tsdoc-begin>
/**
 * Tool group registered from `feedback.ts` (2 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `feedback_details` | `GET` | `/rest/3/reporting/developer-space/{developerId}/feedback/details` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-feedback-details-get) |
 * | `feedback_metrics_by_metric` | `GET` | `/rest/3/reporting/developer-space/{developerId}/feedback/metrics/{metric}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-feedback-metrics-metric-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`feedback_details`, `feedback_metrics_by_metric`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerFeedbackTools } from "./tools/feedback.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerFeedbackTools(server);
 * // Now these tools are live: `feedback_details`, `feedback_metrics_by_metric`
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerFeedbackTools(server: McpServer): void {
  server.tool(
    "feedback_details",
    "Raw customer feedback entries (uninstall/disable/unsubscribe events with reasons + free-text messages). Returns `{_links:{self,query,next}, feedback:[{addonKey, addonVersion, applicationKey, applicationVersion, hosting, date, feedbackType, reasonKey, reason, message, fullName, appEntitlementId, appEntitlementNumber, productId}]}`. `_links.next` paginates. Filter by type/reason/hosting/addon/productId/anonymous/text + date range. NOTE: contains customer PII (names, free-text comments).",
    FEEDBACK_DETAILS_FILTERS,
    READ_ONLY,
    async (args) => {
      const data = await request({
        path: `${REPORTING_BASE}/feedback/details`,
        query: asQuery(args),
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "feedback_metrics_by_metric",
    "Feedback time-series grouped by a metric. FLAT `total.series[]` (no datasets, no uniqueTotal) — one series per group value, each `{name, elements:[{date,count}]}` — plus per-app `addons[]`. For `metric=reason` series are reasonKeys (bugs, merging, not-meeting-needs, other, project-based, sandbox, usefulness); for `metric=type` series are feedbackTypes (disable, uninstall, unsubscribe). Only aggregation/startDate/endDate filter (productId/hosting/addon are ignored).",
    {
      metric: z.enum(["reason", "type"])
        .describe("Path segment. Allowable per Atlassian: `reason` or `type`. Anything else → HTTP 400."),
      aggregation: z.enum(["week", "month"]).optional()
        .describe("Time-series bucket cadence. Default week. Invalid → 400."),
      startDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
      endDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
    },
    READ_ONLY,
    async ({ metric, ...filters }) => {
      const data = await request({
        path: `${REPORTING_BASE}/feedback/metrics/${metric}`,
        query: asQuery(filters),
      });
      return jsonResult(data);
    }
  );
}
