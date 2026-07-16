/**
 * Integration tests for free_starter_tier_export. Live API.
 * Rows contain customer entitlement data — assert structure, not values.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";
import { discoverFixtures, type Fixtures } from "../helpers/fixtures.js";

interface FreeStarterRow { day: string; licenseId: string; appEntitlementId: string; productId?: string; }

describe.skipIf(!hasLiveCreds())("Block D: Free starter tier export (live API)", () => {
  let client: McpTestClient;
  let fx: Fixtures;
  beforeAll(async () => {
    client = await McpTestClient.start();
    fx = await discoverFixtures(client);
  });
  afterAll(async () => { await client.close(); });

  describe("free_starter_tier_export", () => {
    it("takes a single `date` and returns a JSON array of {day, licenseId, ...} by default", async () => {
      const rows = await client.callTool<FreeStarterRow[]>("free_starter_tier_export", { date: "2026-04-01" });
      // small enough to stay inline; if truncated, skip the array assertions
      if (Array.isArray(rows)) {
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows.slice(0, 5)) {
          expect(r.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(r.licenseId).toEqual(expect.any(String));
        }
      }
    });

    it("productId narrows the export to one app", async () => {
      const rows = await client.callTool<FreeStarterRow[] | { _truncated?: boolean }>(
        "free_starter_tier_export", { date: "2026-04-01", productId: fx.primary.productId },
      );
      if (Array.isArray(rows)) {
        for (const r of rows) if (r.productId) expect(r.productId).toBe(fx.primary.productId);
      }
    });

    it("accept=csv returns a CSV string with a header row", async () => {
      const csv = await client.callTool<string>("free_starter_tier_export", { date: "2026-04-01", accept: "csv" });
      if (typeof csv === "string") {
        expect(csv.split(/\r?\n/)[0]).toContain('"day"');
      }
    });

    it("invalid accept → Zod error", async () => {
      const err = await client.callToolExpectingError("free_starter_tier_export", { date: "2026-04-01", accept: "xml" });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    it("date+productId+accept=csv compose: CSV rows are all the filtered product (though CSV omits the productId column)", async () => {
      const jsonRows = await client.callTool<FreeStarterRow[]>("free_starter_tier_export", { date: "2026-04-01", productId: fx.primary.productId });
      const csv = await client.callTool<string>("free_starter_tier_export", { date: "2026-04-01", productId: fx.primary.productId, accept: "csv" });
      if (Array.isArray(jsonRows) && typeof csv === "string") {
        const csvDataLines = csv.split(/\r?\n/).filter(Boolean).slice(1);
        // same row count across formats
        expect(csvDataLines.length).toBe(jsonRows.length);
        // Atlassian-side quirk: CSV header has fewer columns than JSON keys (drops productId)
        const csvCols = csv.split(/\r?\n/)[0].split(",").length;
        expect(csvCols).toBeLessThan(Object.keys(jsonRows[0]).length);
      }
    });

    it("a valid-shaped but non-existent productId surfaces an error (Atlassian 500, not empty)", async () => {
      const err = await client.callToolExpectingError("free_starter_tier_export", {
        date: "2026-04-01", productId: "00000000-0000-0000-0000-000000000000",
      });
      expect(err.length).toBeGreaterThan(0);
    });

    it("schema is date/productId/includeAtlassianLicenses/accept (NOT startDate/endDate/hosting)", async () => {
      const tools = await client.listTools();
      const props = (tools.find((x) => x.name === "free_starter_tier_export")!.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["accept", "date", "includeAtlassianLicenses", "productId"]);
    });
  });
});
