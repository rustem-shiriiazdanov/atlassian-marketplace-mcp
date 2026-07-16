import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, asQuery, REPORTING_BASE, TX_FILTERS, READ_ONLY, WRITE_SAFE, EXPORT_TIMEOUT_MS, ACCEPT_CSV_JSON, exportAcceptHeader } from "./_shared.js";

const TX_BASE = `${REPORTING_BASE}/sales/transactions`;

// <auto-tsdoc-begin>
/**
 * Tool group registered from `transactions.ts` (7 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `transactions_list` | `GET` | `/rest/3/reporting/developer-space/{developerId}/sales/transactions` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-get) |
 * | `transactions_export_sync` | `GET` | `/rest/3/reporting/developer-space/{developerId}/sales/transactions/export` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-export-get) |
 * | `transactions_export_async_start` | `POST` | `/rest/3/reporting/developer-space/{developerId}/sales/transactions/async/export` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-async-export-post) |
 * | `transactions_export_async_status` | `GET` | `/rest/3/reporting/developer-space/{developerId}/sales/transactions/async/export/{exportId}/status` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-async-export-exportid-status-get) |
 * | `transactions_export_async_download` | `GET` | `/rest/3/reporting/developer-space/{developerId}/sales/transactions/async/export/{exportId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-async-export-exportid-get) |
 * | `transactions_aggregate_by_metric` | `GET` | `/rest/3/reporting/developer-space/{developerId}/sales/transactions/{metric}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-metric-get) |
 * | `transactions_aggregate_by_hosting` | `GET` | `/rest/3/reporting/developer-space/{developerId}/sales/transactions/{metric}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-metric-get) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`transactions_list`, `transactions_export_sync`, `transactions_export_async_start`, `transactions_export_async_status`, `transactions_export_async_download`, `transactions_aggregate_by_metric`, `transactions_aggregate_by_hosting`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerTransactionTools } from "./tools/transactions.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerTransactionTools(server);
 * // Now these tools are live: `transactions_list`, `transactions_export_sync`, `transactions_export_async_start`, …
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerTransactionTools(server: McpServer): void {
  // transactions_list — runtime description (LLM-facing) carries all per-tool detail;
  // see TX_FILTERS for param docs and docs/TOOLS.md for the regenerated catalog.
  server.tool(
    "transactions_list",
    "List sales transactions for this vendor's apps (refunds appear inline as negative amounts). NOTE per Atlassian: this endpoint can return 5xx on large datasets — for full pulls, prefer transactions_export_async_start + status + download. Use 'text' to find by transactionId, licenseId, SEN, customer info, or partner info.",
    TX_FILTERS,
    READ_ONLY,
    async (args) => {
      const data = await request({
        path: TX_BASE,
        query: asQuery(args),
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "transactions_export_sync",
    "Synchronous export of transactions. `accept=csv` (default) returns a CSV string; `accept=json` returns a JSON array. Prefer async for large ranges. Request timeout is 10 min (overridable via EXPORT_TIMEOUT_MS env).",
    { ...TX_FILTERS, ...ACCEPT_CSV_JSON },
    READ_ONLY,
    async (args) => {
      const data = await request({
        path: `${TX_BASE}/export`,
        query: asQuery(args),
        accept: exportAcceptHeader(args.accept),
        timeoutMs: EXPORT_TIMEOUT_MS,
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "transactions_export_async_start",
    "Start an async transactions export job. Returns `{export:{id}}` to poll. `accept=csv|json` sets the eventual download format (start response is always the id envelope).",
    { ...TX_FILTERS, ...ACCEPT_CSV_JSON },
    WRITE_SAFE,
    async (args) => {
      const data = await request({
        method: "POST",
        path: `${TX_BASE}/async/export`,
        query: asQuery(args),
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "transactions_export_async_status",
    "Poll status of an async transactions export job.",
    { exportId: z.string() },
    READ_ONLY,
    async ({ exportId }) =>
      jsonResult(
        await request({
          path: `${TX_BASE}/async/export/${exportId}/status`,
        })
      )
  );

  server.tool(
    "transactions_export_async_download",
    "Download a completed async transactions export. Returns the JSON array of transaction records. Request timeout is 10 min (overridable via EXPORT_TIMEOUT_MS env). Only call this after the *_status endpoint reports DONE — otherwise you'll get a 404 'Export is being processed'.",
    { exportId: z.string() },
    READ_ONLY,
    async ({ exportId }) =>
      jsonResult(
        await request({
          path: `${TX_BASE}/async/export/${exportId}`,
          timeoutMs: EXPORT_TIMEOUT_MS,
        })
      )
  );

  server.tool(
    "transactions_aggregate_by_metric",
    "Aggregated sales grouped by a metric path segment. Maps to /sales/transactions/{metric}.",
    {
      metric: z.enum(["country", "hosting", "partner", "region", "tier", "type"])
        .describe("Allowable values per Atlassian: country, hosting, partner, region, tier, type"),
      aggregation: z.enum(["month", "week"]).optional()
        .describe("Time bucket granularity for the series — month or week."),
      productId: z.string().optional()
        .describe("Optional product UUID. Not documented in swagger but accepted by the live API and applied."),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      hosting: z.enum(["cloud", "datacenter", "server"]).optional(),
    },
    READ_ONLY,
    async ({ metric, ...filters }) => {
      const data = await request({
        path: `${TX_BASE}/${metric}`,
        query: asQuery(filters),
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "transactions_aggregate_by_hosting",
    "Friendly alias for transactions_aggregate_by_metric(metric='hosting'). HAL template `hosting{?aggregation,startDate,endDate}`. NOTE: `productId` is silently ignored on this specific endpoint (verified 2026-06-03) — use `transactions_aggregate_by_metric` with `metric=hosting` if you need productId scoping.",
    {
      aggregation: z.enum(["month", "week"]).optional()
        .describe("Time bucket granularity for the series — month or week."),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    },
    READ_ONLY,
    async (args) => {
      const data = await request({
        path: `${TX_BASE}/hosting`,
        query: asQuery(args),
      });
      return jsonResult(data);
    }
  );
}
