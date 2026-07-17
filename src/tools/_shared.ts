import { z } from "zod";
import { createHash } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { request } from "../http-client.js";
import { config } from "../config.js";

export const REPORTING_BASE = `/rest/3/reporting/developer-space/${config.developerId}`;
export const PROMO_BASE = `/catalog/partners/${config.partnerId}/promotions`;

// Truncation threshold. `MAX_RESPONSE_CHARS=0` (or negative) DISABLES truncation
// entirely — responses of any size are returned inline. Default 50_000 (~12k tokens).
const RAW_MAX_RESPONSE_CHARS = Number(process.env.MAX_RESPONSE_CHARS ?? 50000);
const TRUNCATION_DISABLED = !Number.isFinite(RAW_MAX_RESPONSE_CHARS) || RAW_MAX_RESPONSE_CHARS <= 0;
const MAX_RESPONSE_CHARS = TRUNCATION_DISABLED ? Infinity : RAW_MAX_RESPONSE_CHARS;

/**
 * Per-request timeout for tools that can legitimately take minutes:
 * - sync exports (licenses/transactions to CSV in one call)
 * - async export downloads (the actual large payload)
 * Configurable via env so power users can bump it for huge multi-GB pulls.
 */
export const EXPORT_TIMEOUT_MS = Number(process.env.EXPORT_TIMEOUT_MS ?? 10 * 60_000);

/**
 * `accept=csv|json` query param shared by the reporting EXPORT endpoints
 * (verified 2026-06-03 + OpenAPI spec). Spread into an export tool's schema
 * (NOT the shared filter sets — the non-export list siblings don't take it).
 */
export const ACCEPT_CSV_JSON = {
  accept: z.enum(["csv", "json"]).optional()
    .describe("Output format: `csv` (default for these exports — header-rowed CSV string) or `json` (array of records). Invalid → HTTP 400."),
};

/** HTTP Accept header matching an `accept=csv|json` query value (default csv). */
export function exportAcceptHeader(accept?: string): string {
  return accept === "json" ? "application/json" : "text/csv";
}

/**
 * Wrap any value in the MCP `{content:[{type:"text",text:...}]}` envelope that
 * MCP tools must return.
 *
 * **Truncation behavior:** if the serialized response exceeds
 * `MAX_RESPONSE_CHARS` (default 50_000, ~12k tokens; override via env), the
 * full payload is dumped to a tmp file in the OS temp dir
 * (`<os.tmpdir()>/atlassian-mcp-<sha1-16>.{json,txt}` — e.g. `/tmp` on Linux/macOS,
 * `%TEMP%` on Windows)
 * and the returned envelope contains a small summary + 2k preview + file path.
 * Subsequent calls with the same content reuse the existing file (filename is a
 * content hash). Set `MAX_RESPONSE_CHARS=0` env to disable truncation entirely.
 *
 * @param data  The value to wrap. Strings are passed through verbatim;
 *   anything else is `JSON.stringify(..., null, 2)`-formatted.
 * @returns An MCP tool-result envelope: `{ content: [{ type: "text", text: string }] }`.
 *   When truncated, `text` is the JSON-stringified summary; otherwise it's the
 *   data verbatim.
 *
 * @example Small response — passed through:
 * ```ts
 * jsonResult({ ok: true });
 * // → { content: [{ type: "text", text: '{\n  "ok": true\n}' }] }
 * ```
 *
 * @example Large response — spilled to disk:
 * ```ts
 * jsonResult({ items: Array(10_000).fill({ ... }) });
 * // → { content: [{ type: "text", text: '{
 * //   "_truncated": true,
 * //   "_file": "/tmp/atlassian-mcp-ab12cd34ef567890.json",
 * //   "_bytes": 1234567,
 * //   "_hint": "Response exceeded MAX_RESPONSE_CHARS. ...",
 * //   "_preview": "..."
 * // }' }] }
 * ```
 */
export function jsonResult(data: unknown) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  if (text.length <= MAX_RESPONSE_CHARS) {
    return { content: [{ type: "text" as const, text }] };
  }
  const hash = createHash("sha1").update(text).digest("hex").slice(0, 16);
  const looksJson = text.trimStart().startsWith("{") || text.trimStart().startsWith("[");
  const ext = looksJson ? "json" : "txt";
  const path = join(tmpdir(), `atlassian-mcp-${hash}.${ext}`);
  if (!existsSync(path)) writeFileSync(path, text, "utf-8");
  const summary = {
    _truncated: true,
    _file: path,
    // Actual on-disk UTF-8 byte size (NOT JS string length, which under-counts
    // multibyte chars by up to 4×). Matches `stat` / the file's true size.
    _bytes: Buffer.byteLength(text, "utf-8"),
    _chars: text.length,
    _hint: "Response exceeded MAX_RESPONSE_CHARS. The COMPLETE payload was written to _file — read it with your filesystem/Read tool (or jq/grep) to get the full dataset; this envelope is only a preview. Alternatives: narrow the date range, use aggregation=month, or set env MAX_RESPONSE_CHARS=0 to return everything inline.",
    _preview: text.slice(0, 2000),
  };
  return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
}

// Canonical tool annotations per MCP 2024-11 spec.
// Read-only tools default to safe/idempotent; destructive tools surface explicit hints.
export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};
export const WRITE_SAFE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};
export const DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export function asQuery(args: Record<string, unknown>): Record<string, string | number | boolean | undefined> {
  const out: Record<string, string | number | boolean | undefined> = {};
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined) continue;
    out[k] = v as string | number | boolean;
  }
  return out;
}

/**
 * Filter parameters common to virtually all Marketplace reporting endpoints (licenses, transactions,
 * evaluations, feedback metrics, search keywords, …).
 *
 * Atlassian-side semantics (probed 2026-06-01):
 * - `productId` accepts a single product UUID. Multi-value support via comma-separated lists
 *   is broken; use separate tool calls for multiple products and union results client-side.
 * - `startDate` / `endDate` are inclusive on both bounds. **No validation that start ≤ end** —
 *   passing a reversed range returns an empty result set silently.
 * - `hosting` filter is **lowercase one-word** (`cloud` / `datacenter` / `server`); response
 *   bodies show the value Pascal-cased (`Cloud` / `Data Center` / `Server`). Note `datacenter`,
 *   not `data_center`.
 * - These parameters are array-typed in the swagger but our schema exposes scalar versions for
 *   simplicity.
 *
 * @see LICENSE_FILTERS — spreads this + tier/dateType/licenseType/etc.
 * @see TX_FILTERS — spreads this + saleType/billingPeriod/paymentStatus/etc.
 */
export const REPORTING_DATE_FILTERS = {
  productId: z.string().optional()
    .describe("Product UUID (or comma-separated list). Use apps_list / apps_known to discover."),
  startDate: z.string().optional().describe("ISO date YYYY-MM-DD"),
  endDate: z.string().optional().describe("ISO date YYYY-MM-DD"),
  hosting: z.enum(["cloud", "datacenter", "server"]).optional()
    .describe("Note: 'datacenter' is one word, not 'data_center'. Response objects use capitalized 'Cloud'/'Server'/'Data Center' but the filter param is lowercase one-word."),
};

/**
 * Pagination + sort parameters shared by list/search endpoints.
 *
 * - `limit` is enforced server-side at **max 50**; Zod also enforces.
 * - `offset` is zero-based. Atlassian also returns a HAL `_links.next` href that
 *   includes the next offset.
 * - `sortBy` is **endpoint-specific** — this `z.string()` default is overridden in
 *   `LICENSE_FILTERS` and `TX_FILTERS` with the endpoint's enum of allowed values.
 * - **`order` quirk:** silently ignored by Atlassian on `licenses_list` (every value of
 *   `sortBy` returns the same sequence regardless of asc/desc). It DOES work on
 *   `transactions_list`. Verified via direct curl, not just MCP, on 2026-06-01.
 */
export const PAGINATION_FILTERS = {
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  sortBy: z.string().optional(),
  // NOTE on `order`: per probing on 2026-06-01, Atlassian silently IGNORES this
  // parameter on licenses_list across every sortBy value — results always come
  // back in the API's default order (descending by the sort key). Documented
  // here so callers don't waste effort relying on it.
  order: z.enum(["asc", "desc"]).optional(),
};

/**
 * Filter set for license endpoints
 * (`licenses_list`, `licenses_export_sync`, `licenses_export_async_start`).
 *
 * Spread of {@link REPORTING_DATE_FILTERS} + {@link PAGINATION_FILTERS} plus
 * license-specific filters. Notable specifics:
 *
 * - **Enum values probed live (2026-06-01)**, not lifted from the partially-stale swagger.
 *   Specifically: `licenseType` has 11 values (swagger lists 9; missing
 *   `net_new_evaluation`, `upgrade_evaluation`, `starter`); `partnerType` has 4 values
 *   (swagger lists 3, missing `upgrade`); `cloudComplianceBoundaries` is the same.
 * - `tier` is an **integer** (user count) per the live API ("Must be a list of valid integer"),
 *   not a string. Response shows it as `"10 Users"` / `"Evaluation"` etc.
 * - `dateType` has only **two values** (`start`, `end`) — *not* `maintenance`/`lastUpdated`
 *   as suggested by older docs. With `dateType=end` the filter is "license active within the
 *   window" (overlap semantic), NOT "ended within the window".
 * - `showLicensesHistory` is real but **not in the swagger** — discovered via HAL query
 *   template. Toggle returns the per-license event timeline (multiple rows per SEN).
 * - `licenseLevel` (single-instance / multi-instance) is also not in the swagger but accepted
 *   by the live API.
 * - **`order` is silently ignored on this endpoint** — see {@link PAGINATION_FILTERS}.
 *
 * @see REPORTING_DATE_FILTERS for productId/startDate/endDate/hosting
 * @see PAGINATION_FILTERS for offset/limit/order (sortBy overridden below with license-specific enum)
 */
export const LICENSE_FILTERS = {
  ...REPORTING_DATE_FILTERS,
  ...PAGINATION_FILTERS,
  sortBy: z.enum([
    "addonName", "company", "country", "endDate", "hosting",
    "licenseId", "licenseType", "partner", "region", "startDate", "tier",
  ]).optional(),
  text: z.string().optional()
    .describe("Free-text search across identifiers: SEN, appEntitlementNumber (Cloud), appEntitlementId (UUID), cloudId, cloudSiteHostname, email, organization name."),
  // tier is the user-count (3, 10, 25, ...), not the human-readable string.
  // Response objects show e.g. "10 Users" / "Evaluation" / "Unlimited Users";
  // the filter takes the integer. Atlassian: "tier: Must be a list of valid integer".
  tier: z.number().int().optional(),
  dateType: z.enum(["start", "end"]).optional(),
  licenseType: z.enum([
    "academic", "commercial", "demonstration", "evaluation",
    "net_new_evaluation", "upgrade_evaluation",
    "open_source", "starter", "free", "classroom", "legacy_free",
  ]).optional(),
  licenseLevel: z.enum(["single-instance", "multi-instance"]).optional(),
  partnerType: z.enum(["direct", "expert", "reseller", "upgrade"]).optional(),
  status: z.enum(["active", "inactive", "cancelled"]).optional(),
  withAttribution: z.boolean().optional()
    .describe("DEPRECATED by Atlassian; use withDataInsights instead. Both add evaluation/attribution fields when true."),
  withDataInsights: z.boolean().optional()
    .describe("Adds 10 extra fields to each license: evaluationOpportunitySize, evaluationLicense, daysToConvertEval, evaluationStartDate, evaluationEndDate, evaluationSaleDate, parentProductBillingCycle, parentProductName, installedOnSandbox, parentProductEdition."),
  includeAtlassianLicenses: z.boolean().optional()
    .describe("If true, include internal Atlassian licenses in the result."),
  showLicensesHistory: z.boolean().optional()
    .describe("If true, returns the full history of license events for matched SENs (multiple rows per license). Not formally in the swagger but the runtime API accepts it."),
  showLifeTimeFreeLicenses: z.boolean().optional()
    .describe("If true, scope the response to lifetime-free-tier licenses. If false (default), excludes them."),
  cloudComplianceBoundaries: z.enum(["commercial", "fedramp_moderate", "isolated_cloud"]).optional()
    .describe("Cloud compliance boundary. Valid values: 'commercial' (default), 'fedramp_moderate', 'isolated_cloud'. **Cloud-hosted apps only — silently ignored for server/datacenter apps.** Defaults to 'commercial' when omitted on cloud apps. NOTE: This MCP currently accepts a single value; to query multiple boundaries make separate calls (probed 2026-06-01: comma-separated lists are silently mis-parsed by the API — only repeated-param form works server-side)."),
  appEdition: z.enum(["free", "standard", "advanced"]).optional()
    .describe("Filter by app edition (case-insensitive in practice but lowercase per Atlassian's error spec)."),
  lastUpdated: z.string().optional().describe("ISO datetime — licenses updated on/after this instant."),
};

/**
 * Filter set for sales transaction endpoints
 * (`transactions_list`, `transactions_export_sync`, `transactions_export_async_start`).
 *
 * Source-of-truth notes:
 * - **Enum values were probed against Atlassian's live error responses**, not lifted from the swagger.
 *   The swagger spec is partially stale: it omits `downgrade` from `saleType`, omits `upgrade` from
 *   `partnerType`, capitalizes `appEdition` values, and doesn't list `billingPeriod` at all.
 *   Our schema reflects what the API actually accepts as of 2026-06-01.
 * - All array-typed swagger params (`productId*`, `tier*`, `saleType*`, …) are exposed here as
 *   **single-value scalars**. Multi-value filtering via comma-separated lists is broken at
 *   Atlassian (silently mis-parsed); the only working multi-value form is repeated query params
 *   (`?productId=a&productId=b`), which this MCP's HTTP layer doesn't currently emit. For
 *   multi-value queries today, **make separate tool calls and union the results client-side**.
 *
 * Atlassian-side behaviors confirmed:
 * - `order` IS respected on `transactions_list` (contrast with `licenses_list`, where it's silently ignored).
 * - `lastUpdated` is an **inclusive lower bound** ("on or after").
 * - One Atlassian transaction may span multiple apps as line items. **Row-unique identifier is
 *   `transactionLineItemId`, not `transactionId`.**
 *
 * @see REPORTING_DATE_FILTERS for the inherited `productId`/`startDate`/`endDate`/`hosting`
 * @see PAGINATION_FILTERS for the inherited `offset`/`limit`/`order` (note: `sortBy` is overridden below with a tx-specific enum)
 */
export const TX_FILTERS = {
  ...REPORTING_DATE_FILTERS,
  ...PAGINATION_FILTERS,
  // Per probing: transactions_list DOES respect `order` (unlike licenses_list).
  sortBy: z.enum([
    "addonName", "company", "country", "date", "hosting", "licenseId",
    "licenseType", "partner", "partnerType", "purchasePrice", "region",
    "saleType", "tier", "transactionId", "vendorAmount", "paymentStatus",
  ]).optional(),
  text: z.string().optional()
    .describe("Free-text search across identifiers: transactionId, licenseId, SEN, appEntitlementNumber, customer info, partner info."),
  // tier is the user-count (3, 10, 25, ...) — same as licenses_list filter.
  // Response objects show tier as "10 Users" / "Evaluation" inside purchaseDetails.tier.
  tier: z.number().int().optional(),
  saleType: z.enum(["new", "refund", "downgrade", "renewal", "upgrade"]).optional(),
  partnerType: z.enum(["direct", "expert", "reseller", "upgrade"]).optional(),
  billingPeriod: z.enum(["monthly", "annual"]).optional()
    .describe("Filter by billing period. Not documented in swagger but accepted by the live API."),
  lastUpdated: z.string().optional()
    .describe("ISO date/datetime — returns transactions updated ON OR AFTER this date (inclusive lower bound)."),
  excludeZeroTransactions: z.boolean().optional()
    .describe("If true, omits $0 transactions (e.g. Cloud Free tier)."),
  includeManualInvoice: z.boolean().optional()
    .describe("If true, includes manually-invoiced transactions in the response."),
  paymentStatus: z.enum(["paid", "refunded", "uncollectible", "open"]).optional(),
  cloudComplianceBoundaries: z.enum(["commercial", "fedramp_moderate", "isolated_cloud"]).optional()
    .describe("Cloud compliance boundary on the underlying license. Valid: 'commercial' (default), 'fedramp_moderate', 'isolated_cloud'. **Cloud-hosted apps only — ignored for server/datacenter.** Single value here; for multiple, make separate calls."),
  appEdition: z.enum(["free", "standard", "advanced"]).optional()
    .describe("Filter by app edition (free / standard / advanced)."),
};

/**
 * Async export helper. Three flavors exist in the API:
 *   - licenses     :  /licenses/async/export(/{exportId}{,/status})
 *   - transactions :  /sales/transactions/async/export(/{exportId}{,/status})
 *   - marketing    :  /marketing-attribution/async/export  (start)
 *                     /async/export/{exportId}(/status)    (status + download — NO prefix)
 *
 * Pass the start path explicitly; status + download paths can be derived in callers
 * because they differ between licenses/transactions vs marketing-attribution.
 */
export async function startAsyncExport(startPath: string, query: Record<string, unknown>) {
  return request({ method: "POST", path: startPath, query: asQuery(query) });
}

export async function getAsyncExportStatus(statusPath: string) {
  return request({ path: statusPath });
}

export async function downloadAsyncExport(downloadPath: string) {
  return request<string>({ path: downloadPath, accept: "text/csv" });
}
