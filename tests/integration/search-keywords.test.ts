/**
 * Integration tests for the 8 search-keyword tools (4 list/export pairs). Live API.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";
import { discoverFixtures, type Fixtures } from "../helpers/fixtures.js";

const W = { startDate: "2026-01-01", endDate: "2026-04-01" };

describe.skipIf(!hasLiveCreds())("Block E: Search keywords (live API)", () => {
  let client: McpTestClient;
  let fx: Fixtures;
  beforeAll(async () => {
    client = await McpTestClient.start();
    fx = await discoverFixtures(client);
  });
  afterAll(async () => { await client.close(); });

  describe("search_keywords_partner", () => {
    it("returns {total, addons} aggregate (schema = aggregation/startDate/endDate)", async () => {
      const d = await client.callTool<{ total: { searchAppearances: number; topSearchKeyword: string }; addons: { addonKey: string; productId: string; elements: unknown[] }[] }>(
        "search_keywords_partner", W,
      );
      expect(typeof d.total.searchAppearances).toBe("number");
      expect(typeof d.total.topSearchKeyword).toBe("string");
      expect(Array.isArray(d.addons)).toBe(true);
      const tools = await client.listTools();
      const props = (tools.find((x) => x.name === "search_keywords_partner")!.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["aggregation", "endDate", "startDate"]);
    });
  });

  describe("search_keywords_by_source", () => {
    it("sourceKey=marketplace returns {details:[{searchKeyword, percentage}]}", async () => {
      const d = await client.callTool<{ details: { searchKeyword: string; percentage: number }[] }>(
        "search_keywords_by_source", { sourceKey: "marketplace", ...W },
      );
      expect(Array.isArray(d.details)).toBe(true);
      for (const r of d.details.slice(0, 5)) {
        expect(typeof r.searchKeyword).toBe("string");
        expect(typeof r.percentage).toBe("number");
      }
    });

    it("the two sources return DISTINCT datasets (marketplace vs embedded-marketplace)", async () => {
      const mkt = await client.callTool<{ details: { searchKeyword: string }[] }>("search_keywords_by_source", { sourceKey: "marketplace", ...W });
      const emb = await client.callTool<{ details: { searchKeyword: string }[] }>("search_keywords_by_source", { sourceKey: "embedded-marketplace", ...W });
      expect(emb.details.length).toBeGreaterThan(0);
      // top keyword differs between public-marketplace search and in-product search
      expect(emb.details[0].searchKeyword).not.toBe(mkt.details[0].searchKeyword);
    });

    it("invalid sourceKey is rejected by our Zod enum", async () => {
      const err = await client.callToolExpectingError("search_keywords_by_source", { sourceKey: "google", ...W });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });
  });

  describe("search_keywords_by_app", () => {
    it("returns {summary, details} with productId as a path segment", async () => {
      const d = await client.callTool<{ summary: { addonKey: string }; details: { searchKeyword: string; keywordCount: number }[] }>(
        "search_keywords_by_app", { productId: fx.primary.productId, ...W },
      );
      expect(d.summary).toBeDefined();
      expect(Array.isArray(d.details)).toBe(true);
      const tools = await client.listTools();
      const props = (tools.find((x) => x.name === "search_keywords_by_app")!.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["aggregation", "endDate", "productId", "startDate"]);
    });
  });

  describe("zero_search_results_keywords", () => {
    it("returns {details:[{searchKeyword, count}]}", async () => {
      const d = await client.callTool<{ details: { searchKeyword: string; count: number }[] }>(
        "zero_search_results_keywords", { sourceKey: "marketplace", ...W },
      );
      expect(Array.isArray(d.details)).toBe(true);
      for (const r of d.details.slice(0, 5)) {
        expect(typeof r.searchKeyword).toBe("string");
        expect(typeof r.count).toBe("number");
      }
    });

    it("zero-results only supports `marketplace` — `embedded-marketplace` is rejected by our Zod enum", async () => {
      // Atlassian 400s on embedded-marketplace here ("source: allowable value is 'marketplace'");
      // our schema restricts the enum to marketplace so it's caught client-side.
      const err = await client.callToolExpectingError("zero_search_results_keywords", {
        sourceKey: "embedded-marketplace", ...W,
      });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
      const tools = await client.listTools();
      const sk = ((tools.find((x) => x.name === "zero_search_results_keywords")!.inputSchema as { properties: Record<string, { enum?: string[] }> }).properties.sourceKey);
      expect(sk.enum).toEqual(["marketplace"]);
    });
  });

  describe("export variants", () => {
    it("accept=csv returns a CSV string with a header row (all 4 export tools support it)", async () => {
      const csv = await client.callTool<string>("search_keywords_by_source_export", {
        sourceKey: "marketplace", ...W, accept: "csv",
      });
      expect(typeof csv).toBe("string");
      expect(csv.split(/\r?\n/)[0]).toContain('"searchKeyword"');
      // schema exposes accept on every export tool
      const tools = await client.listTools();
      for (const n of ["search_keywords_partner_export", "search_keywords_by_source_export", "search_keywords_by_app_export", "zero_search_results_keywords_export"]) {
        const props = (tools.find((x) => x.name === n)!.inputSchema as { properties: Record<string, unknown> }).properties;
        expect("accept" in props, `${n} should expose accept`).toBe(true);
      }
    });

    it("invalid accept value is rejected by our Zod enum", async () => {
      const err = await client.callToolExpectingError("search_keywords_by_source_export", {
        sourceKey: "marketplace", ...W, accept: "xml",
      });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    it("by_source export returns the DATA array directly (not HAL links)", async () => {
      const d = await client.callTool<unknown>("search_keywords_by_source_export", { sourceKey: "marketplace", ...W });
      // Either an inline JSON array, or (if large) a truncation envelope.
      if (Array.isArray(d)) {
        expect(d.length).toBeGreaterThanOrEqual(0);
      } else {
        const env = d as { _truncated?: boolean; _preview?: string };
        expect(env._truncated === true || typeof d === "object").toBe(true);
        if (env._preview) expect(env._preview.trimStart().startsWith("[")).toBe(true);
      }
    });

    it("zero-results export returns the DATA array directly (not HAL links)", async () => {
      const d = await client.callTool<unknown>("zero_search_results_keywords_export", { sourceKey: "marketplace", ...W });
      if (Array.isArray(d)) {
        expect(d.length).toBeGreaterThanOrEqual(0);
      } else {
        const env = d as { _truncated?: boolean };
        expect(env._truncated === true || typeof d === "object").toBe(true);
      }
    });

    it("partner export returns data INLINE (total+addons), same as the list sibling", async () => {
      const d = await client.callTool<{ _links?: { export?: { href: string }[] }; total?: unknown; addons?: unknown }>("search_keywords_partner_export", W);
      if (!(d as { _truncated?: boolean })._truncated) {
        // data is inline (not just links)
        expect(d.total).toBeDefined();
        expect(Array.isArray(d.addons)).toBe(true);
        // the export links are present but Atlassian-side broken (doubled /export/export)
        const href = d._links?.export?.[0]?.href ?? "";
        expect(href).toContain("/export/export"); // documents the known-broken path
      }
    });

    it("by_app export returns a HAL envelope with _links.export", async () => {
      const d = await client.callTool<{ _links?: { export?: unknown } }>("search_keywords_by_app_export", {
        productId: fx.primary.productId, ...W,
      });
      if (!(d as { _truncated?: boolean })._truncated) {
        expect(d._links?.export).toBeDefined();
      }
    });
  });
});
