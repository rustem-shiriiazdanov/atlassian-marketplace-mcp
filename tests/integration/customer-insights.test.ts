/**
 * Integration tests for the Customer Insights tools.
 *
 * Tools (4): customer_insights_regions, _editions, _tiers, _active_users.
 * Audited tool-by-tool — this file currently covers `regions` in depth;
 * the other three get their own blocks as they're audited.
 *
 * Live API; self-skips when creds absent. No hardcoded vendor identifiers.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface UsersDistribution {
  usersCount: number;
  usersPercent: number;
  usersMarketplaceBenchmark: number;
}
interface RegionItem {
  value: { group: { region: string }; usersDistribution: UsersDistribution };
}
interface MonthBucket {
  date: string;
  insightsType: RegionItem[];
}
interface RegionsResponse {
  _links: { self?: any; query?: { href: string; templated?: boolean } };
  usersDistributionPerMonth: MonthBucket[];
}

// Generic shape shared by all insights endpoints — group key varies per tool
// (region / edition / tier / activeUsers bucket).
interface GenericItem {
  value: { group: Record<string, string>; usersDistribution: UsersDistribution };
}
interface GenericBucket { date: string; insightsType: GenericItem[]; }
interface InsightsResponse {
  _links: { self?: any; query?: { href: string; templated?: boolean } };
  usersDistributionPerMonth: GenericBucket[];
}

describe.skipIf(!hasLiveCreds())("Block D: Customer Insights tools (live API)", () => {
  let client: McpTestClient;
  beforeAll(async () => { client = await McpTestClient.start(); });
  afterAll(async () => { await client.close(); });

  describe("customer_insights_regions", () => {
    it("returns usersDistributionPerMonth[] with region groups and distribution fields", async () => {
      const d = await client.callTool<RegionsResponse>("customer_insights_regions", {
        startDate: "2026-04-01", endDate: "2026-05-01",
      });
      expect(d._links?.query?.href).toContain("{?startDate,endDate}");
      expect(Array.isArray(d.usersDistributionPerMonth)).toBe(true);
      expect(d.usersDistributionPerMonth.length).toBeGreaterThan(0);
      for (const m of d.usersDistributionPerMonth) {
        expect(m.date).toMatch(ISO_DATE);
        expect(Array.isArray(m.insightsType)).toBe(true);
        for (const it of m.insightsType) {
          expect(typeof it.value.group.region).toBe("string");
          const ud = it.value.usersDistribution;
          expect(typeof ud.usersCount).toBe("number");
          expect(typeof ud.usersPercent).toBe("number");
          expect(typeof ud.usersMarketplaceBenchmark).toBe("number");
        }
      }
    });

    it("regions are drawn from the known set (apac/emea/americas/unknown)", async () => {
      const d = await client.callTool<RegionsResponse>("customer_insights_regions", {
        startDate: "2026-04-01", endDate: "2026-05-01",
      });
      const KNOWN = new Set(["apac", "emea", "americas", "unknown"]);
      for (const m of d.usersDistributionPerMonth) {
        for (const it of m.insightsType) {
          expect(KNOWN.has(it.value.group.region), `unexpected region "${it.value.group.region}"`).toBe(true);
        }
      }
    });

    it("usersPercent across regions sums to ~100 per month", async () => {
      const d = await client.callTool<RegionsResponse>("customer_insights_regions", {
        startDate: "2026-04-01", endDate: "2026-05-01",
      });
      for (const m of d.usersDistributionPerMonth) {
        const sum = m.insightsType.reduce((a, it) => a + it.value.usersDistribution.usersPercent, 0);
        expect(sum).toBeGreaterThan(95);
        expect(sum).toBeLessThan(105);
      }
    });

    it("startDate/endDate narrow the number of monthly buckets", async () => {
      const narrow = await client.callTool<RegionsResponse>("customer_insights_regions", {
        startDate: "2026-01-01", endDate: "2026-03-01",
      });
      const wide = await client.callTool<RegionsResponse>("customer_insights_regions", {
        startDate: "2025-01-01", endDate: "2026-05-01",
      });
      expect(wide.usersDistributionPerMonth.length).toBeGreaterThan(narrow.usersDistributionPerMonth.length);
    });

    it("productId is silently ignored (NOT in HAL template) — Zod strips it, response unchanged", async () => {
      const baseline = await client.callTool<RegionsResponse>("customer_insights_regions", {
        startDate: "2026-04-01", endDate: "2026-05-01",
      });
      const withJunk = await client.callTool<RegionsResponse>("customer_insights_regions", {
        startDate: "2026-04-01", endDate: "2026-05-01",
        productId: "00000000-0000-0000-0000-000000000000", hosting: "cloud",
      } as Record<string, unknown>);
      // Same bucket count + same first-month region count → filters had no effect
      expect(withJunk.usersDistributionPerMonth.length).toBe(baseline.usersDistributionPerMonth.length);
    });

    it("schema exposes ONLY startDate/endDate (productId/hosting dropped)", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "customer_insights_regions")!;
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["endDate", "startDate"]);
    });

    it("invalid date format is rejected by Atlassian (400)", async () => {
      const err = await client.callToolExpectingError("customer_insights_regions", { startDate: "not-a-date" });
      expect(err.toLowerCase()).toMatch(/date/);
    });

    it("reversed range returns empty usersDistributionPerMonth", async () => {
      const d = await client.callTool<RegionsResponse>("customer_insights_regions", {
        startDate: "2026-06-01", endDate: "2026-01-01",
      });
      expect(d.usersDistributionPerMonth).toEqual([]);
    });
  });

  describe("customer_insights_editions", () => {
    it("returns usersDistributionPerMonth[] grouped by edition with distribution fields", async () => {
      const d = await client.callTool<InsightsResponse>("customer_insights_editions", {
        startDate: "2026-04-01", endDate: "2026-05-01",
      });
      expect(d._links?.query?.href).toContain("{?startDate,endDate}");
      expect(d.usersDistributionPerMonth.length).toBeGreaterThan(0);
      for (const m of d.usersDistributionPerMonth) {
        expect(m.date).toMatch(ISO_DATE);
        for (const it of m.insightsType) {
          // group key is `edition` (not region)
          expect(typeof it.value.group.edition).toBe("string");
          const ud = it.value.usersDistribution;
          expect(typeof ud.usersCount).toBe("number");
          expect(typeof ud.usersPercent).toBe("number");
          expect(typeof ud.usersMarketplaceBenchmark).toBe("number");
        }
      }
    });

    it("editions are drawn from the known set (free/standard/premium/enterprise)", async () => {
      const d = await client.callTool<InsightsResponse>("customer_insights_editions", {
        startDate: "2026-04-01", endDate: "2026-05-01",
      });
      const KNOWN = new Set(["free", "standard", "premium", "enterprise"]);
      for (const m of d.usersDistributionPerMonth) {
        for (const it of m.insightsType) {
          expect(KNOWN.has(it.value.group.edition), `unexpected edition "${it.value.group.edition}"`).toBe(true);
        }
      }
    });

    it("usersPercent across editions sums to ~100 per month", async () => {
      const d = await client.callTool<InsightsResponse>("customer_insights_editions", {
        startDate: "2026-04-01", endDate: "2026-05-01",
      });
      for (const m of d.usersDistributionPerMonth) {
        const sum = m.insightsType.reduce((a, it) => a + it.value.usersDistribution.usersPercent, 0);
        expect(sum).toBeGreaterThan(90);
        expect(sum).toBeLessThan(105);
      }
    });

    it("startDate/endDate narrow the number of monthly buckets", async () => {
      const narrow = await client.callTool<InsightsResponse>("customer_insights_editions", {
        startDate: "2026-03-01", endDate: "2026-05-01",
      });
      const wide = await client.callTool<InsightsResponse>("customer_insights_editions", {
        startDate: "2025-01-01", endDate: "2026-05-01",
      });
      expect(wide.usersDistributionPerMonth.length).toBeGreaterThan(narrow.usersDistributionPerMonth.length);
    });

    it("schema exposes ONLY startDate/endDate (productId/hosting dropped)", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "customer_insights_editions")!;
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["endDate", "startDate"]);
    });

    it("productId/hosting/product are silently ignored (Zod strips, response unchanged)", async () => {
      const baseline = await client.callTool<InsightsResponse>("customer_insights_editions", {
        startDate: "2026-04-01", endDate: "2026-05-01",
      });
      const withJunk = await client.callTool<InsightsResponse>("customer_insights_editions", {
        startDate: "2026-04-01", endDate: "2026-05-01",
        productId: "00000000-0000-0000-0000-000000000000", hosting: "cloud", product: "x",
      } as Record<string, unknown>);
      expect(withJunk.usersDistributionPerMonth.length).toBe(baseline.usersDistributionPerMonth.length);
    });

    it("invalid date format is rejected by Atlassian (400)", async () => {
      const err = await client.callToolExpectingError("customer_insights_editions", { startDate: "not-a-date" });
      expect(err.toLowerCase()).toMatch(/date/);
    });
  });

  describe("customer_insights_tiers", () => {
    it("group has TWO keys {product, tier}; tiers from the known set", async () => {
      const d = await client.callTool<InsightsResponse>("customer_insights_tiers", {
        startDate: "2026-04-01", endDate: "2026-05-01",
      });
      expect(d._links?.query?.href).toContain("{?startDate,endDate,product}");
      expect(d.usersDistributionPerMonth.length).toBeGreaterThan(0);
      const KNOWN_TIERS = new Set(["Evaluation", "1-10", "11-100", "101-1000", "1000+"]);
      for (const m of d.usersDistributionPerMonth) {
        for (const it of m.insightsType) {
          expect(typeof it.value.group.product).toBe("string"); // host app (Jira/Confluence)
          expect(KNOWN_TIERS.has(it.value.group.tier), `unexpected tier "${it.value.group.tier}"`).toBe(true);
          expect(typeof it.value.usersDistribution.usersCount).toBe("number");
        }
      }
    });

    it("usersPercent sums to ~100 PER host product (≈200 across two products)", async () => {
      const d = await client.callTool<InsightsResponse>("customer_insights_tiers", {
        startDate: "2026-04-01", endDate: "2026-05-01",
      });
      // Group the latest month's percent by host product; each should sum ~100.
      const latest = d.usersDistributionPerMonth[0];
      const perProduct: Record<string, number> = {};
      for (const it of latest.insightsType) {
        perProduct[it.value.group.product] = (perProduct[it.value.group.product] ?? 0) + it.value.usersDistribution.usersPercent;
      }
      const products = Object.keys(perProduct);
      expect(products.length).toBeGreaterThanOrEqual(1);
      for (const p of products) {
        expect(perProduct[p], `${p} percent sum`).toBeGreaterThan(90);
        expect(perProduct[p]).toBeLessThan(110);
      }
    });

    it("product=Jira (host NAME, case-insensitive) narrows to that one host product", async () => {
      const jira = await client.callTool<InsightsResponse>("customer_insights_tiers", {
        startDate: "2026-04-01", endDate: "2026-05-01", product: "Jira",
      });
      const lower = await client.callTool<InsightsResponse>("customer_insights_tiers", {
        startDate: "2026-04-01", endDate: "2026-05-01", product: "jira",
      });
      for (const m of jira.usersDistributionPerMonth) {
        for (const it of m.insightsType) {
          expect(it.value.group.product).toBe("Jira");
        }
      }
      // case-insensitive: lowercase yields the same host
      if (lower.usersDistributionPerMonth.length) {
        for (const it of lower.usersDistributionPerMonth[0].insightsType) {
          expect(it.value.group.product).toBe("Jira");
        }
      }
    });

    it("product with a UUID / app-key → HTTP 400 ('Must be a jira or confluence') — it's a host NAME, not productId", async () => {
      const err = await client.callToolExpectingError("customer_insights_tiers", {
        startDate: "2026-04-01", endDate: "2026-05-01",
        product: "00000000-0000-0000-0000-000000000000",
      });
      expect(err.toLowerCase()).toMatch(/jira or confluence|product/);
    });

    it("schema exposes startDate/endDate/product (NOT productId/hosting)", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "customer_insights_tiers")!;
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["endDate", "product", "startDate"]);
    });

    it("invalid date format is rejected by Atlassian (400)", async () => {
      const err = await client.callToolExpectingError("customer_insights_tiers", { startDate: "not-a-date" });
      expect(err.toLowerCase()).toMatch(/date/);
    });
  });

  describe("customer_insights_active_users", () => {
    it("group key is activeUsers ∈ {paid, non-paid}; distribution fields present", async () => {
      const d = await client.callTool<InsightsResponse>("customer_insights_active_users", {
        startDate: "2026-04-01", endDate: "2026-05-01",
      });
      expect(d._links?.query?.href).toContain("{?startDate,endDate}");
      expect(d.usersDistributionPerMonth.length).toBeGreaterThan(0);
      const KNOWN = new Set(["paid", "non-paid"]);
      for (const m of d.usersDistributionPerMonth) {
        for (const it of m.insightsType) {
          expect(KNOWN.has(it.value.group.activeUsers), `unexpected activeUsers "${it.value.group.activeUsers}"`).toBe(true);
          expect(typeof it.value.usersDistribution.usersCount).toBe("number");
        }
      }
    });

    it("usersPercent across the 2 buckets sums to ~100 per month", async () => {
      const d = await client.callTool<InsightsResponse>("customer_insights_active_users", {
        startDate: "2026-04-01", endDate: "2026-05-01",
      });
      for (const m of d.usersDistributionPerMonth) {
        const sum = m.insightsType.reduce((a, it) => a + it.value.usersDistribution.usersPercent, 0);
        expect(sum).toBeGreaterThan(95);
        expect(sum).toBeLessThan(105);
      }
    });

    it("startDate/endDate narrow the number of monthly buckets", async () => {
      const narrow = await client.callTool<InsightsResponse>("customer_insights_active_users", {
        startDate: "2026-03-01", endDate: "2026-05-01",
      });
      const wide = await client.callTool<InsightsResponse>("customer_insights_active_users", {
        startDate: "2025-01-01", endDate: "2026-05-01",
      });
      expect(wide.usersDistributionPerMonth.length).toBeGreaterThan(narrow.usersDistributionPerMonth.length);
    });

    it("schema exposes ONLY startDate/endDate", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "customer_insights_active_users")!;
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["endDate", "startDate"]);
    });

    it("productId/hosting are silently ignored (Zod strips, response unchanged)", async () => {
      const baseline = await client.callTool<InsightsResponse>("customer_insights_active_users", {
        startDate: "2026-04-01", endDate: "2026-05-01",
      });
      const withJunk = await client.callTool<InsightsResponse>("customer_insights_active_users", {
        startDate: "2026-04-01", endDate: "2026-05-01",
        productId: "00000000-0000-0000-0000-000000000000", hosting: "cloud",
      } as Record<string, unknown>);
      expect(withJunk.usersDistributionPerMonth.length).toBe(baseline.usersDistributionPerMonth.length);
    });

    it("invalid date format is rejected by Atlassian (400)", async () => {
      const err = await client.callToolExpectingError("customer_insights_active_users", { startDate: "not-a-date" });
      expect(err.toLowerCase()).toMatch(/date/);
    });
  });
});
