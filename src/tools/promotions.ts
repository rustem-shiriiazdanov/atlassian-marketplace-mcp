import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "../http-client.js";
import { jsonResult, PROMO_BASE, READ_ONLY, DESTRUCTIVE } from "./_shared.js";

// <auto-tsdoc-begin>
/**
 * Tool group registered from `promotions.ts` (10 tools).
 *
 * Auto-generated from `TOOL_ENDPOINTS` (in `_spec-links.ts`). Re-run
 * `npm run docs:tsdoc` after adding/renaming tools to refresh.
 *
 * | Tool | Method | Endpoint | Docs |
 * |---|---|---|---|
 * | `promotions_list_paged` | `GET` | `/catalog/partners/{partnerId}/promotions/paged` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-paged-get) |
 * | `promotions_list` | `GET` | `/catalog/partners/{partnerId}/promotions` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-get) |
 * | `promotions_create` | `POST` | `/catalog/partners/{partnerId}/promotions` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-post) |
 * | `promotions_get` | `GET` | `/catalog/partners/{partnerId}/promotions/{promotionId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-get) |
 * | `promotions_update` | `PATCH` | `/catalog/partners/{partnerId}/promotions/{promotionId}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-patch) |
 * | `promotions_status` | `GET` | `/catalog/partners/{partnerId}/promotions/{promotionId}/status` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-status-get) |
 * | `promotions_codes_list` | `GET` | `/catalog/partners/{partnerId}/promotions/{promotionId}/codes` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-get) |
 * | `promotions_codes_create` | `POST` | `/catalog/partners/{partnerId}/promotions/{promotionId}/codes` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-post) |
 * | `promotions_code_get` | `GET` | `/catalog/partners/{partnerId}/promotions/{promotionId}/codes/{promotionCode}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-promotioncode-get) |
 * | `promotions_code_delete` | `DELETE` | `/catalog/partners/{partnerId}/promotions/{promotionId}/codes/{promotionCode}` | [docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-promotioncode-delete) |
 *
 * @param server  Active MCP server. Each tool below becomes callable via
 *   the JSON-RPC `tools/call` method immediately after this function returns.
 *   Tools carry MCP annotations (`readOnlyHint`, `destructiveHint`,
 *   `idempotentHint`) from the `READ_ONLY` / `WRITE_SAFE` / `DESTRUCTIVE`
 *   constants in `_shared.ts` so clients can reason about safety up front.
 *
 * @returns `void`. The function's effect is **registration as a side effect**
 *   on `server` — the listed tools (`promotions_list_paged`, `promotions_list`, `promotions_create`, `promotions_get`, `promotions_update`, `promotions_status`, `promotions_codes_list`, `promotions_codes_create`, `promotions_code_get`, `promotions_code_delete`) become live.
 *   Each tool's input is validated by a Zod schema before its handler runs;
 *   handler output is wrapped through `jsonResult()` which auto-spills
 *   payloads larger than `MAX_RESPONSE_CHARS` (default 50k) to a tmp file.
 *
 * @example
 * ```ts
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerPromotionTools } from "./tools/promotions.js";
 *
 * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });
 * registerPromotionTools(server);
 * // Now these tools are live: `promotions_list_paged`, `promotions_list`, `promotions_create`, …
 * ```
 *
 * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as `/v4/` even though the wire URL paths are `/rest/3/...`. Promotion endpoints are v1.
 */
// <auto-tsdoc-end>
export function registerPromotionTools(server: McpServer): void {
  server.tool(
    "promotions_list_paged",
    "List promotions (paginated). STRONGLY prefer this over promotions_list (the non-paged variant can time out). Returns `{_links, promotions:[…], offset, limit, totalItems, orderBy, nextId, prevId}`. Cloud uses cursor pagination via `nextId`/`prevId` (and `totalItems` is null); Server/DC uses `offset`/`limit`. Each promotion carries ~21 fields — a full page can exceed the response size cap and spill to a temp file, so page with a modest `limit`.",
    {
      limit: z.number().int().min(1).max(1500).default(50).optional()
        .describe("Page size for Server/DC (max 1500)"),
      offset: z.number().int().min(0).optional()
        .describe("Skip N items for Server/DC pagination"),
      orderBy: z.enum(["START_DATE", "EXPIRATION_DATE", "CREATION_DATE"]).optional(),
      activeOnly: z.boolean().optional(),
      hostingType: z.enum(["SERVER", "DATA_CENTER", "CLOUD"]).optional(),
      appKey: z.string().optional()
        .describe("Filter to promotions eligible for this app key. GOTCHA: an unknown/mistyped app key is SILENTLY IGNORED by the API — it returns ALL promotions, not zero. Only a real, exact app key actually narrows the result."),
      ascending: z.boolean().optional(),
      nextId: z.string().optional().describe("Cloud-only forward page cursor"),
      prevId: z.string().optional().describe("Cloud-only backward page cursor"),
    },
    READ_ONLY,
    async (args) => {
      const data = await request({
        path: `${PROMO_BASE}/paged`,
        query: {
          limit: args.limit,
          offset: args.offset,
          "order-by": args.orderBy,
          "active-only": args.activeOnly,
          "hosting-type": args.hostingType,
          "app-key": args.appKey,
          ascending: args.ascending,
          nextId: args.nextId,
          prevId: args.prevId,
        },
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "promotions_list",
    "List ALL promotions in one non-paginated response (legacy). WARNING: on partners with many promotions this endpoint is very slow and can hit the request timeout (60s, then retried) — effectively hanging. Prefer promotions_list_paged in almost all cases; use this only when you truly need every promotion at once and know the set is small.",
    {},
    READ_ONLY,
    async () => jsonResult(await request({ path: PROMO_BASE }))
  );

  server.tool(
    "promotions_create",
    "Create a new promotion. PUBLIC IMPACT: promo code becomes redeemable by customers. Required: name, eligibleApps, expirationDate, hostingType, promotionType, discountType.",
    {
      name: z.string(),
      eligibleApps: z.array(z.string()).describe("App keys this promotion applies to"),
      startDate: z.string().optional().describe("ISO datetime (YYYY-MM-DDTHH:mm:ssZ). Plain YYYY-MM-DD is auto-padded with T00:00:00Z by this tool."),
      expirationDate: z.string().describe("ISO datetime (YYYY-MM-DDTHH:mm:ssZ). Plain YYYY-MM-DD is auto-padded with T00:00:00Z by this tool."),
      promotionType: z.enum(["SHARED_PROMOTION", "SINGLE_USE_PROMOTION"]),
      discountType: z.literal("FLAT_DISCOUNT"),
      discountPercent: z.number().int().min(1).max(100).optional(),
      maxUses: z.number().int().min(1).optional()
        .describe("Required for shared promotions unless allowUnlimitedUses=true"),
      hostingType: z.enum(["SERVER", "DATA_CENTER", "CLOUD"]),
      subscriptionType: z.enum(["MONTHLY", "ANNUAL"]).optional()
        .describe("Cloud only"),
      allowedBillingCycles: z.number().int().min(1).optional()
        .describe("Cloud only"),
      allowUnlimitedUses: z.boolean().optional(),
      customPromoCode: z.string().optional()
        .describe("Cloud only; will be prefixed with autogen string for shared promos"),
    },
    DESTRUCTIVE,
    async (args) => {
      const padDate = (s: string | undefined) =>
        s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : s;
      const body = {
        ...args,
        startDate: padDate(args.startDate),
        expirationDate: padDate(args.expirationDate)!,
      };
      const data = await request({
        method: "POST",
        path: PROMO_BASE,
        body,
      });
      return jsonResult(data);
    }
  );

  server.tool(
    "promotions_get",
    "Get one promotion by ID. Returns the full promotion object (~21 fields: id, name, eligibleApps, startDate, expirationDate, status, promotionType, discountType, discountPercent, maxUses, used, hostingType, promotionCode, …). GOTCHA: a nonexistent/malformed promotionId returns HTTP 500 (not 404).",
    { promotionId: z.string().describe("UUID for Cloud, string for Server/DC") },
    READ_ONLY,
    async ({ promotionId }) =>
      jsonResult(await request({ path: `${PROMO_BASE}/${promotionId}` }))
  );

  server.tool(
    "promotions_update",
    "Update a promotion (PATCH — only supplied fields change).",
    {
      promotionId: z.string(),
      name: z.string().optional(),
      startDate: z.string().optional(),
      expirationDate: z.string().optional(),
      discountPercent: z.number().int().min(1).max(100).optional(),
      maxUses: z.number().int().min(1).optional(),
      allowedBillingCycles: z.number().int().min(1).optional(),
    },
    DESTRUCTIVE,
    async ({ promotionId, ...body }) => {
      await request({
        method: "PATCH",
        path: `${PROMO_BASE}/${promotionId}`,
        body,
      });
      return jsonResult({ ok: true, promotionId });
    }
  );

  server.tool(
    "promotions_status",
    "Get the status of a promotion (ACTIVE | ENDED_EARLY | EXPIRED).",
    { promotionId: z.string() },
    READ_ONLY,
    async ({ promotionId }) =>
      jsonResult(await request({ path: `${PROMO_BASE}/${promotionId}/status` }))
  );

  server.tool(
    "promotions_codes_list",
    "List single-use codes for a SINGLE_USE_PROMOTION.",
    { promotionId: z.string() },
    READ_ONLY,
    async ({ promotionId }) =>
      jsonResult(await request({ path: `${PROMO_BASE}/${promotionId}/codes` }))
  );

  server.tool(
    "promotions_codes_create",
    "Generate a new single-use code for a promotion.",
    { promotionId: z.string() },
    DESTRUCTIVE,
    async ({ promotionId }) => {
      await request({
        method: "POST",
        path: `${PROMO_BASE}/${promotionId}/codes`,
      });
      return jsonResult({ ok: true, promotionId });
    }
  );

  server.tool(
    "promotions_code_get",
    "Get one single-use code (including usage info if redeemed).",
    {
      promotionId: z.string(),
      promotionCode: z.string().describe("Promotion code identifier (string like 'VN5U6M')"),
    },
    READ_ONLY,
    async ({ promotionId, promotionCode }) =>
      jsonResult(await request({ path: `${PROMO_BASE}/${promotionId}/codes/${promotionCode}` }))
  );

  server.tool(
    "promotions_code_delete",
    "Delete an unused single-use code.",
    {
      promotionId: z.string(),
      promotionCode: z.string().describe("Promotion code identifier (string like 'VN5U6M')"),
    },
    DESTRUCTIVE,
    async ({ promotionId, promotionCode }) => {
      await request({
        method: "DELETE",
        path: `${PROMO_BASE}/${promotionId}/codes/${promotionCode}`,
      });
      return jsonResult({ ok: true });
    }
  );
}
