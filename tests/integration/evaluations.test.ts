/**
 * Integration tests for evaluations_by_metric. Live API; self-skips without creds.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Series { name: string; uniqueTotal?: number; elements: { date: string; count: number }[]; }
interface EvalResp {
  _links: { query?: { href: string } };
  total: { name: string; series: Series[] };
  addons: { addonKey: string; series: Series[] }[];
}

describe.skipIf(!hasLiveCreds())("Block D: Evaluations (live API)", () => {
  let client: McpTestClient;
  beforeAll(async () => { client = await McpTestClient.start(); });
  afterAll(async () => { await client.close(); });

  describe("evaluations_by_metric", () => {
    // NOTE: `metric=country` over a wide window pretty-prints past the 50k
    // truncation threshold (the raw response is ~45k but jsonResult indents).
    // Use `hosting` (3 series) for shape and a narrow month window for the
    // all-paths sweep so responses stay inline.
    it("metric=hosting returns FLAT total.series (no datasets/uniqueTotal) + addons", async () => {
      const d = await client.callTool<EvalResp>("evaluations_by_metric", {
        metric: "hosting", startDate: "2026-01-01", endDate: "2026-04-01",
      });
      expect(d._links?.query?.href).toContain("{?aggregation,startDate,endDate}");
      expect(Array.isArray(d.total.series)).toBe(true);
      expect((d.total as { datasets?: unknown }).datasets).toBeUndefined();
      for (const s of d.total.series) {
        expect(s.uniqueTotal).toBeUndefined();
        for (const e of s.elements) {
          expect(e.date).toMatch(ISO_DATE);
          expect(typeof e.count).toBe("number");
        }
      }
      expect(Array.isArray(d.addons)).toBe(true);
    });

    it("all four metric paths (country/hosting/partner/region) return series", async () => {
      // 1-month + month aggregation keeps even high-cardinality `country` inline.
      for (const metric of ["country", "hosting", "partner", "region"] as const) {
        const d = await client.callTool<EvalResp>("evaluations_by_metric", {
          metric, startDate: "2026-03-01", endDate: "2026-04-01", aggregation: "month",
        });
        expect(Array.isArray(d.total.series), `${metric} should return series`).toBe(true);
      }
    });

    it("invalid metric is rejected by our Zod enum", async () => {
      const err = await client.callToolExpectingError("evaluations_by_metric", { metric: "tier" });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    it("aggregation=week returns more elements than aggregation=month", async () => {
      const week = await client.callTool<EvalResp>("evaluations_by_metric", {
        metric: "hosting", startDate: "2026-01-01", endDate: "2026-04-01", aggregation: "week",
      });
      const month = await client.callTool<EvalResp>("evaluations_by_metric", {
        metric: "hosting", startDate: "2026-01-01", endDate: "2026-04-01", aggregation: "month",
      });
      const w = week.total.series[0]?.elements.length ?? 0;
      const m = month.total.series[0]?.elements.length ?? 0;
      expect(w).toBeGreaterThan(m);
    });

    it("invalid aggregation is rejected by our Zod enum", async () => {
      const err = await client.callToolExpectingError("evaluations_by_metric", {
        metric: "country", aggregation: "daily",
      });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    it("schema exposes metric/aggregation/startDate/endDate (NOT productId/hosting)", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "evaluations_by_metric")!;
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["aggregation", "endDate", "metric", "startDate"]);
    });

    it("reversed range returns empty total.series + addons", async () => {
      const d = await client.callTool<EvalResp>("evaluations_by_metric", {
        metric: "country", startDate: "2026-06-01", endDate: "2026-01-01",
      });
      expect(d.total.series).toEqual([]);
      expect(d.addons).toEqual([]);
    });
  });
});
