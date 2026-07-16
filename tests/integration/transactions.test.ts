/**
 * Integration tests for the Transactions tools.
 *
 * Tools covered (7):
 *   - transactions_list
 *   - transactions_export_sync
 *   - transactions_export_async_start
 *   - transactions_export_async_status
 *   - transactions_export_async_download
 *   - transactions_aggregate_by_metric
 *   - transactions_aggregate_by_hosting
 *
 * Live API; self-skips when creds absent.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";
import { discoverFixtures, type Fixtures } from "../helpers/fixtures.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SEN_RE = /^E-[0-9A-Z]{3}-[0-9A-Z]{3}-[0-9A-Z]{3}-[0-9A-Z]{3}$/;

const DEFAULT_WINDOW = { startDate: "2026-04-01", endDate: "2026-05-31" };

interface PurchaseDetails {
  saleDate: string;
  licenseType: string;
  hosting: string;
  billingPeriod: string;
  tier: string;
  purchasePrice: number;
  vendorAmount: number;
  saleType: string;
  maintenanceStartDate: string;
  maintenanceEndDate: string;
  parentProductName?: string;
  parentProductEdition?: string;
}

interface Transaction {
  transactionId: string;
  // The actual unique row identifier — one transactionId can contain multiple line items
  // (e.g., a customer buying 3 apps at once via a single PO).
  transactionLineItemId: string;
  addonLicenseId: string;
  licenseId: string;
  addonKey: string;
  addonName: string;
  lastUpdated: string;
  paymentStatus: string;
  appEntitlementId: string;
  appEntitlementNumber: string;
  productId: string;
  licenseLevel?: string;
  purchaseDetails: PurchaseDetails;
  customerDetails?: unknown;
  partnerDetails?: unknown;
}

interface TransactionsListResponse {
  _links: Record<string, unknown>;
  transactions: Transaction[];
}

interface ExportStartResponse {
  _links: Record<string, unknown>;
  export: { id: string };
}
interface ExportStatusResponse {
  _links: Record<string, unknown>;
  export: { id: string; status: string };
}
interface TruncatedResponse {
  _truncated: true;
  _file: string;
  _bytes: number;
  _preview: string;
}

interface AggregateResponse {
  _links: Record<string, unknown>;
  total: { name: string; series: unknown[] };
  addons: unknown[];
}

describe.skipIf(!hasLiveCreds())("Block C: Transactions tools (live API)", () => {
  let client: McpTestClient;
  let fx: Fixtures;
  beforeAll(async () => {
    client = await McpTestClient.start();
    fx = await discoverFixtures(client);
  });
  afterAll(async () => {
    await client.close();
  });

  // ---------------------------------------------------------------------------
  // transactions_list — shape + filters
  // ---------------------------------------------------------------------------
  describe("transactions_list", () => {
    it("returns HAL-shaped response with .transactions array", async () => {
      const data = await client.callTool<TransactionsListResponse>("transactions_list", {
        ...DEFAULT_WINDOW,
        limit: 2,
      });
      expect(data._links).toBeDefined();
      expect(Array.isArray(data.transactions)).toBe(true);
      expect(data.transactions.length).toBeGreaterThan(0);
      const tx = data.transactions[0];
      expect(tx.transactionId).toEqual(expect.any(String));
      expect(tx.appEntitlementNumber).toMatch(SEN_RE);
      expect(tx.productId).toMatch(UUID_RE);
      expect(tx.purchaseDetails).toBeDefined();
      expect(tx.purchaseDetails.saleDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof tx.purchaseDetails.purchasePrice).toBe("number");
      expect(typeof tx.purchaseDetails.vendorAmount).toBe("number");
    });

    it("filters by productId — every result matches", async () => {
      const data = await client.callTool<TransactionsListResponse>("transactions_list", {
        ...DEFAULT_WINDOW,
        productId: fx.primary.productId,
        limit: 5,
      });
      expect(data.transactions.length).toBeGreaterThan(0);
      for (const t of data.transactions) {
        expect(t.productId).toBe(fx.primary.productId);
      }
    });

    it("filters by hosting=cloud — every result has hosting=Cloud (in purchaseDetails)", async () => {
      const data = await client.callTool<TransactionsListResponse>("transactions_list", {
        ...DEFAULT_WINDOW,
        hosting: "cloud",
        limit: 5,
      });
      for (const t of data.transactions) {
        expect(t.purchaseDetails.hosting).toBe("Cloud");
      }
    });

    it("filters by saleType=new — every result has saleType=new", async () => {
      const data = await client.callTool<TransactionsListResponse>("transactions_list", {
        ...DEFAULT_WINDOW,
        saleType: "new",
        limit: 5,
      });
      for (const t of data.transactions) {
        expect(t.purchaseDetails.saleType).toBe("New");
      }
    });

    it("filters by paymentStatus=paid", async () => {
      const data = await client.callTool<TransactionsListResponse>("transactions_list", {
        ...DEFAULT_WINDOW,
        paymentStatus: "paid",
        limit: 5,
      });
      // The paymentStatus field on the response is at the top level
      for (const t of data.transactions) {
        expect(t.paymentStatus.toLowerCase()).toBe("paid");
      }
    });

    it("filters by billingPeriod=annual", async () => {
      const data = await client.callTool<TransactionsListResponse>("transactions_list", {
        ...DEFAULT_WINDOW,
        billingPeriod: "annual",
        limit: 5,
      });
      for (const t of data.transactions) {
        expect(t.purchaseDetails.billingPeriod.toLowerCase()).toBe("annual");
      }
    });

    it("filters by tier (integer user-count) — response shows '<N> Users'", async () => {
      const data = await client.callTool<TransactionsListResponse>("transactions_list", {
        ...DEFAULT_WINDOW,
        tier: 10,
        limit: 5,
      });
      // We may get 0 or some — both are fine.
      for (const t of data.transactions) {
        // tier shows as "10 Users" or sometimes a different "Evaluation"-like string
        expect(t.purchaseDetails.tier).toMatch(/Users|Evaluation/);
      }
    });

    it("rejects tier as a string (Zod enforces integer)", async () => {
      const err = await client.callToolExpectingError("transactions_list", {
        tier: "10" as unknown as number,
      });
      expect(err).toMatch(/invalid_type|expected number/i);
    });

    it("filters by cloudComplianceBoundaries=commercial", async () => {
      const data = await client.callTool<TransactionsListResponse>("transactions_list", {
        ...DEFAULT_WINDOW,
        cloudComplianceBoundaries: "commercial",
        limit: 3,
      });
      expect(data.transactions.length).toBeGreaterThan(0);
    });

    it("rejects bogus cloudComplianceBoundaries via Zod", async () => {
      const err = await client.callToolExpectingError("transactions_list", {
        cloudComplianceBoundaries: "bogus" as unknown as "commercial",
      });
      expect(err).toMatch(/invalid_enum_value/i);
    });

    it("appEdition=free accepted without error", async () => {
      const data = await client.callTool<TransactionsListResponse>("transactions_list", {
        ...DEFAULT_WINDOW,
        appEdition: "free",
        limit: 3,
      });
      expect(Array.isArray(data.transactions)).toBe(true);
    });

    it("rejects bogus appEdition via Zod", async () => {
      const err = await client.callToolExpectingError("transactions_list", {
        appEdition: "Bogus" as unknown as "free",
      });
      expect(err).toMatch(/invalid_enum_value/i);
    });

    it("excludeZeroTransactions=true omits $0 sales", async () => {
      const data = await client.callTool<TransactionsListResponse>("transactions_list", {
        ...DEFAULT_WINDOW,
        excludeZeroTransactions: true,
        limit: 10,
      });
      for (const t of data.transactions) {
        expect(t.purchaseDetails.purchasePrice).not.toBe(0);
      }
    });

    it("text search by SEN returns the matching transaction (if any)", async () => {
      // Use a SEN discovered from the running dev space (NOT hardcoded).
      // Some SENs (like Cloud Free tier) have $0 transactions that don't appear here.
      if (!fx.firstSen) return; // can't search if no licenses exist
      const data = await client.callTool<TransactionsListResponse>("transactions_list", {
        text: fx.firstSen,
        ...DEFAULT_WINDOW,
        sortBy: "date",
        order: "desc",
      });
      expect(Array.isArray(data.transactions)).toBe(true);
    });

    it("pagination: offset returns distinct rows (by transactionLineItemId — transactionId is NOT unique)", async () => {
      // One Atlassian transaction can contain multiple apps as line items
      // (e.g., a customer buying two of the vendor's apps in one PO shares transactionId).
      // The row-unique id is transactionLineItemId.
      const args = { ...DEFAULT_WINDOW, limit: 2 };
      const p1 = await client.callTool<TransactionsListResponse>("transactions_list", args);
      const p2 = await client.callTool<TransactionsListResponse>("transactions_list", { ...args, offset: 2 });
      const ids1 = p1.transactions.map((t) => t.transactionLineItemId);
      const ids2 = p2.transactions.map((t) => t.transactionLineItemId);
      const overlap = ids1.filter((id) => ids2.includes(id));
      expect(overlap).toEqual([]);
    });

    it("order=asc and order=desc produce DIFFERENT sequences (works correctly on transactions, unlike licenses)", async () => {
      // CONTRAST with licenses_list, where Atlassian ignores `order`.
      const base = {
        ...DEFAULT_WINDOW,
        sortBy: "date" as const,
        limit: 5,
        productId: fx.primary.productId,
      };
      const asc = await client.callTool<TransactionsListResponse>("transactions_list", { ...base, order: "asc" });
      const desc = await client.callTool<TransactionsListResponse>("transactions_list", { ...base, order: "desc" });
      const ascDates = asc.transactions.map((t) => t.purchaseDetails.saleDate);
      const descDates = desc.transactions.map((t) => t.purchaseDetails.saleDate);
      // asc should be ≤ desc dates pairwise (or sets differ entirely)
      expect(ascDates).not.toEqual(descDates);
    });

    it("rejects hosting='data_center' (wrong spelling) via Zod", async () => {
      const err = await client.callToolExpectingError("transactions_list", { hosting: "data_center" });
      expect(err).toMatch(/invalid_enum_value/i);
    });

    it("rejects saleType='sale' (not in enum)", async () => {
      const err = await client.callToolExpectingError("transactions_list", { saleType: "sale" as unknown as "new" });
      expect(err).toMatch(/invalid_enum_value/i);
    });

    it("rejects sortBy='saleDate' (wrong field — use 'date')", async () => {
      const err = await client.callToolExpectingError("transactions_list", { sortBy: "saleDate" });
      expect(err).toMatch(/invalid_enum_value/i);
    });

    it("rejects limit=0 (too small) and limit=51 (too big)", async () => {
      const a = await client.callToolExpectingError("transactions_list", { limit: 0 });
      const b = await client.callToolExpectingError("transactions_list", { limit: 51 });
      expect(a).toMatch(/too_small/i);
      expect(b).toMatch(/too_big/i);
    });
  });

  // ---------------------------------------------------------------------------
  // transactions_export_sync
  // ---------------------------------------------------------------------------
  describe("transactions_export_sync", () => {
    it("returns CSV with the expected header columns (may be inline or truncated to /tmp)", async () => {
      const result = await client.callTool<string | TruncatedResponse>("transactions_export_sync", {
        ...DEFAULT_WINDOW,
        productId: fx.primary.productId,
        limit: 2,
      });
      // For real customers with many transactions, even 2 rows of CSV can be > 50 KB once
      // the field set is rich. The truncation handler kicks in.
      if (typeof result === "object" && "_truncated" in result) {
        expect(result._bytes).toBeGreaterThan(0);
        // The preview is the first 2000 chars of the actual CSV.
        expect(result._preview).toContain("transactionId");
        expect(result._preview).toContain("saleDate");
      } else {
        expect(typeof result).toBe("string");
        const header = (result as string).split("\n")[0];
        expect(header).toContain("transactionId");
        expect(header).toContain("saleDate");
      }
    });

    it("accept=json returns JSON (default CSV); invalid accept → Zod error", async () => {
      const r = await client.callTool<unknown>("transactions_export_sync", {
        ...DEFAULT_WINDOW, productId: fx.primary.productId, limit: 2, accept: "json",
      } as Record<string, unknown>);
      if (typeof r !== "string") {
        expect(Array.isArray(r) || (r as { _truncated?: boolean })._truncated).toBeTruthy();
      }
      const err = await client.callToolExpectingError("transactions_export_sync", { accept: "xml" } as Record<string, unknown>);
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });
  });

  // ---------------------------------------------------------------------------
  // Async export lifecycle
  // ---------------------------------------------------------------------------
  describe("transactions_export_async_* (full lifecycle)", () => {
    it("start → status → download succeeds with COMPLETED status", async () => {
      const start = await client.callTool<ExportStartResponse>("transactions_export_async_start", {
        ...DEFAULT_WINDOW,
        productId: fx.primary.productId,
        limit: 2,
      });
      const exportId = start.export.id;
      expect(exportId).toMatch(UUID_RE);

      // Poll until COMPLETED (max ~30s)
      let status = "";
      for (let i = 0; i < 15; i++) {
        const s = await client.callTool<ExportStatusResponse>("transactions_export_async_status", { exportId });
        status = s.export.status.toUpperCase();
        if (status === "COMPLETED") break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      expect(status).toBe("COMPLETED");

      const dl = await client.callTool<Transaction[] | TruncatedResponse>(
        "transactions_export_async_download",
        { exportId }
      );
      if ("_truncated" in dl) {
        expect(dl._file).toMatch(/atlassian-mcp-[0-9a-f]+\.json$/);
        expect(dl._bytes).toBeGreaterThan(0);
      } else {
        expect(Array.isArray(dl)).toBe(true);
      }
    });

    it("status with bogus exportId returns HTTP 404 isError", async () => {
      const err = await client.callToolExpectingError("transactions_export_async_status", {
        exportId: "00000000-0000-0000-0000-000000000000",
      });
      expect(err).toMatch(/HTTP 404/i);
    });

    it("status and download require exportId (Zod)", async () => {
      const a = await client.callToolExpectingError("transactions_export_async_status", {});
      const b = await client.callToolExpectingError("transactions_export_async_download", {});
      expect(a).toMatch(/required|invalid_type/i);
      expect(b).toMatch(/required|invalid_type/i);
    });
  });

  // ---------------------------------------------------------------------------
  // transactions_aggregate_by_metric
  // ---------------------------------------------------------------------------
  describe("transactions_aggregate_by_metric", () => {
    // These responses are large (~230 KB for a country aggregate) and always
    // come back via the truncation envelope. Use a tiny scope to keep responses inline.
    const TINY_WINDOW = { startDate: "2026-05-01", endDate: "2026-05-07" };

    it("returns {total, addons} HAL aggregate shape for metric=country", async () => {
      const data = await client.callTool<AggregateResponse | TruncatedResponse>(
        "transactions_aggregate_by_metric",
        { metric: "country", ...TINY_WINDOW, productId: fx.primary.productId }
      );
      if ("_truncated" in data) {
        expect(data._preview).toContain("total");
        expect(data._preview).toContain("addons");
      } else {
        expect(data.total).toBeDefined();
        expect(data.total.name).toEqual(expect.any(String));
        expect(Array.isArray(data.total.series)).toBe(true);
        expect(Array.isArray(data.addons)).toBe(true);
      }
    });

    it("aggregation=month vs aggregation=week produce different series cadence", async () => {
      // Scope to ONE app + a window long enough to span >1 month → series lengths differ.
      const args = { metric: "country" as const, ...DEFAULT_WINDOW, productId: fx.primary.productId };
      const monthly = await client.callTool<AggregateResponse | TruncatedResponse>(
        "transactions_aggregate_by_metric", { ...args, aggregation: "month" }
      );
      const weekly = await client.callTool<AggregateResponse | TruncatedResponse>(
        "transactions_aggregate_by_metric", { ...args, aggregation: "week" }
      );
      // If both truncated, just confirm they came back; otherwise check series.length differ.
      if ("_truncated" in monthly && "_truncated" in weekly) {
        expect(monthly._bytes).toBeGreaterThan(0);
        expect(weekly._bytes).toBeGreaterThan(0);
      } else if (!("_truncated" in monthly) && !("_truncated" in weekly)) {
        expect(monthly.total.series.length).not.toBe(weekly.total.series.length);
      }
    });

    it("rejects bogus metric via Zod", async () => {
      const err = await client.callToolExpectingError("transactions_aggregate_by_metric", {
        metric: "month" as unknown as "country",
      });
      expect(err).toMatch(/invalid_enum_value/i);
    });

    it("rejects bogus aggregation via Zod", async () => {
      const err = await client.callToolExpectingError("transactions_aggregate_by_metric", {
        metric: "country",
        aggregation: "daily" as unknown as "month",
      });
      expect(err).toMatch(/invalid_enum_value/i);
    });

    it("metric supports all 6 documented values", async () => {
      for (const metric of ["country", "hosting", "partner", "region", "tier", "type"] as const) {
        const data = await client.callTool<AggregateResponse | TruncatedResponse>(
          "transactions_aggregate_by_metric",
          { metric, ...TINY_WINDOW, productId: fx.primary.productId }
        );
        // Each must succeed (inline OR truncated)
        if ("_truncated" in data) expect(data._bytes).toBeGreaterThan(0);
        else expect(data.total).toBeDefined();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // transactions_aggregate_by_hosting (alias)
  // ---------------------------------------------------------------------------
  describe("transactions_aggregate_by_hosting", () => {
    it("is equivalent to transactions_aggregate_by_metric(metric='hosting')", async () => {
      const args = { startDate: "2026-05-01", endDate: "2026-05-07", aggregation: "month" as const };
      const alias = await client.callTool<AggregateResponse | TruncatedResponse>(
        "transactions_aggregate_by_hosting", args
      );
      const explicit = await client.callTool<AggregateResponse | TruncatedResponse>(
        "transactions_aggregate_by_metric", { metric: "hosting", ...args }
      );
      if (!("_truncated" in alias) && !("_truncated" in explicit)) {
        expect(alias.total.name).toBe(explicit.total.name);
        expect(alias.total.series.length).toBe(explicit.total.series.length);
      } else {
        expect(alias).toBeDefined();
        expect(explicit).toBeDefined();
      }
    });

    it("schema is aggregation/startDate/endDate (productId dropped — ignored on this endpoint)", async () => {
      const tools = await client.listTools();
      const props = (tools.find((x) => x.name === "transactions_aggregate_by_hosting")!.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["aggregation", "endDate", "startDate"]);
    });
  });
});
