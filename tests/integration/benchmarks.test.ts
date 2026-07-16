/**
 * Integration tests for benchmark_sales + benchmark_evaluations. Live API.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";
import { discoverFixtures, type Fixtures } from "../helpers/fixtures.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const W = { startDate: "2026-01-01", endDate: "2026-04-01" };

describe.skipIf(!hasLiveCreds())("Block D: Benchmarks (live API)", () => {
  let client: McpTestClient;
  let fx: Fixtures;
  beforeAll(async () => {
    client = await McpTestClient.start();
    fx = await discoverFixtures(client);
  });
  afterAll(async () => { await client.close(); });

  describe("benchmark_sales", () => {
    interface Row { date: string; sale: number; salesPercentile: number; salesMoMGrowthBenchmarkAllPartners: number; }
    interface Resp {
      _links: { query?: { href: string } };
      total: { name: string; salesBenchmarkPerMonth: Row[] };
      addons: { addonKey: string; productId: string; salesBenchmarkPerMonth: Row[] }[];
    }

    it("returns total.salesBenchmarkPerMonth + addons with the documented row fields", async () => {
      const d = await client.callTool<Resp>("benchmark_sales", W);
      expect(d._links?.query?.href).toContain("{?addon");
      expect(Array.isArray(d.total.salesBenchmarkPerMonth)).toBe(true);
      for (const r of d.total.salesBenchmarkPerMonth) {
        expect(r.date).toMatch(ISO_DATE);
        expect(typeof r.sale).toBe("number");
        expect(typeof r.salesPercentile).toBe("number");
        expect(typeof r.salesMoMGrowthBenchmarkAllPartners).toBe("number");
      }
      for (const a of d.addons) {
        expect(a.productId).toMatch(UUID_RE);
        expect(Array.isArray(a.salesBenchmarkPerMonth)).toBe(true);
      }
    });

    it("productId narrows to that one app", async () => {
      const d = await client.callTool<Resp>("benchmark_sales", { ...W, productId: fx.primary.productId });
      expect(d.addons.length).toBe(1);
      expect(d.addons[0].productId).toBe(fx.primary.productId);
    });

    it("addon narrows to that one app", async () => {
      const d = await client.callTool<Resp>("benchmark_sales", { ...W, addon: fx.primary.appKey });
      expect(d.addons.length).toBe(1);
      expect(d.addons[0].addonKey).toBe(fx.primary.appKey);
    });

    it("schema exposes productId/addon/startDate/endDate (NOT hosting)", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "benchmark_sales")!;
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["addon", "endDate", "productId", "startDate"]);
    });

    it("invalid date → 400; reversed range → empty addons", async () => {
      const err = await client.callToolExpectingError("benchmark_sales", { startDate: "bad" });
      expect(err.toLowerCase()).toMatch(/date/);
      const d = await client.callTool<Resp>("benchmark_sales", { startDate: "2026-06-01", endDate: "2026-01-01" });
      expect(d.addons).toEqual([]);
    });
  });

  describe("benchmark_evaluations", () => {
    interface Row { date: string; evaluationCount: number; evaluationPercentile: number; }
    interface Resp {
      _links: { query?: { href: string } };
      totals: { name: string; evaluationBenchmarkPerVendorPerMonth: Row[] };
      addons: { addonKey: string; productId: string; evaluationBenchmarkPerAppPerMonth: Row[] }[];
    }

    it("returns totals (plural) with evaluationBenchmarkPerVendorPerMonth + addons (…PerAppPerMonth)", async () => {
      const d = await client.callTool<Resp>("benchmark_evaluations", W);
      expect(d._links?.query?.href).toContain("{?addon");
      // wrapper is `totals` (plural), distinct from sales' `total`
      expect((d as { total?: unknown }).total).toBeUndefined();
      expect(Array.isArray(d.totals.evaluationBenchmarkPerVendorPerMonth)).toBe(true);
      for (const r of d.totals.evaluationBenchmarkPerVendorPerMonth) {
        expect(r.date).toMatch(ISO_DATE);
        expect(typeof r.evaluationCount).toBe("number");
        expect(typeof r.evaluationPercentile).toBe("number");
      }
      for (const a of d.addons) {
        expect(a.productId).toMatch(UUID_RE);
        // addon-level key differs from total-level (…PerAppPerMonth)
        expect(Array.isArray(a.evaluationBenchmarkPerAppPerMonth)).toBe(true);
      }
    });

    it("productId narrows to that one app", async () => {
      const d = await client.callTool<Resp>("benchmark_evaluations", { ...W, productId: fx.primary.productId });
      expect(d.addons.length).toBe(1);
      expect(d.addons[0].productId).toBe(fx.primary.productId);
    });

    it("schema exposes productId/addon/startDate/endDate (NOT hosting)", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "benchmark_evaluations")!;
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["addon", "endDate", "productId", "startDate"]);
    });
  });
});
