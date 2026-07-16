/**
 * Integration tests for the Feedback tools (feedback_details, feedback_metrics_by_metric).
 * Live API; self-skips without creds. No hardcoded vendor identifiers — app keys
 * are discovered at runtime. Feedback rows contain customer PII; tests assert only
 * on structure and filter behavior, never on specific names/messages.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";
import { discoverFixtures, type Fixtures } from "../helpers/fixtures.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const WIDE = { startDate: "2024-01-01", endDate: "2026-06-01" };

interface FeedbackRow {
  addonKey: string;
  hosting: string;
  date: string;
  feedbackType: string;
  reasonKey: string;
  reason: string;
  fullName?: string;
  productId: string;
}
interface FeedbackResponse {
  _links: { self?: any; query?: { href: string }; next?: any };
  feedback: FeedbackRow[];
}

describe.skipIf(!hasLiveCreds())("Block D: Feedback tools (live API)", () => {
  let client: McpTestClient;
  let fx: Fixtures;
  beforeAll(async () => {
    client = await McpTestClient.start();
    fx = await discoverFixtures(client);
  });
  afterAll(async () => { await client.close(); });

  describe("feedback_details", () => {
    it("returns feedback[] with the documented row shape + HAL query template", async () => {
      const d = await client.callTool<FeedbackResponse>("feedback_details", { ...WIDE, limit: 5 });
      expect(d._links?.query?.href).toContain("{?type");
      expect(Array.isArray(d.feedback)).toBe(true);
      for (const r of d.feedback) {
        expect(r.addonKey).toEqual(expect.any(String));
        expect(r.date).toMatch(ISO_DATE);
        expect(["uninstall", "disable", "unsubscribe"]).toContain(r.feedbackType);
        expect(r.hosting).toMatch(/^(Cloud|Server|Data Center)$/);
        expect(r.productId).toMatch(UUID_RE);
      }
    });

    it("type=disable returns only disable events", async () => {
      const d = await client.callTool<FeedbackResponse>("feedback_details", { ...WIDE, type: "disable", limit: 50 });
      for (const r of d.feedback) expect(r.feedbackType).toBe("disable");
    });

    it("type=bogus is rejected by our Zod enum", async () => {
      const err = await client.callToolExpectingError("feedback_details", { type: "bogus" });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    it("reason filters by reasonKey (every row matches)", async () => {
      // discover a reasonKey present in the data, then filter by it
      const seed = await client.callTool<FeedbackResponse>("feedback_details", { ...WIDE, limit: 50 });
      const reasonKey = seed.feedback[0]?.reasonKey;
      if (!reasonKey) return;
      const d = await client.callTool<FeedbackResponse>("feedback_details", { ...WIDE, reason: reasonKey, limit: 50 });
      for (const r of d.feedback) expect(r.reasonKey).toBe(reasonKey);
    });

    it("addon narrows to one app; productId narrows to one app", async () => {
      const byAddon = await client.callTool<FeedbackResponse>("feedback_details", {
        ...WIDE, addon: fx.primary.appKey, limit: 50,
      });
      for (const r of byAddon.feedback) expect(r.addonKey).toBe(fx.primary.appKey);

      const byProduct = await client.callTool<FeedbackResponse>("feedback_details", {
        ...WIDE, productId: fx.primary.productId, limit: 50,
      });
      for (const r of byProduct.feedback) expect(r.productId).toBe(fx.primary.productId);
    });

    it("anonymous=true returns only rows with empty fullName; anonymous=false only attributed", async () => {
      const anon = await client.callTool<FeedbackResponse>("feedback_details", { ...WIDE, anonymous: true, limit: 10 });
      for (const r of anon.feedback) expect(r.fullName ?? "").toBe("");
      const named = await client.callTool<FeedbackResponse>("feedback_details", { ...WIDE, anonymous: false, limit: 10 });
      for (const r of named.feedback) expect((r.fullName ?? "").length).toBeGreaterThan(0);
    });

    it("anonymous must be a boolean (Zod rejects a string)", async () => {
      const err = await client.callToolExpectingError("feedback_details", { anonymous: "maybe" } as Record<string, unknown>);
      expect(err.toLowerCase()).toMatch(/invalid|expected|boolean/);
    });

    it("appEdition is accepted (spec-documented filter, enum free/standard/advanced)", async () => {
      const d = await client.callTool<FeedbackResponse>("feedback_details", { ...WIDE, appEdition: "advanced", limit: 50 });
      expect(Array.isArray(d.feedback)).toBe(true);
    });

    it("hosting=server returns only Server rows", async () => {
      const d = await client.callTool<FeedbackResponse>("feedback_details", { ...WIDE, hosting: "server", limit: 50 });
      for (const r of d.feedback) expect(r.hosting).toBe("Server");
    });

    it("limit caps at 50 (Zod) and the schema dropped the ignored sortBy/order", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "feedback_details")!;
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect("sortBy" in props).toBe(false);
      expect("order" in props).toBe(false);
      const err = await client.callToolExpectingError("feedback_details", { limit: 999 });
      expect(err.toLowerCase()).toMatch(/50|max|too|big/);
    });
  });

  describe("feedback_metrics_by_metric", () => {
    interface Series { name: string; uniqueTotal?: number; elements: { date: string; count: number }[]; }
    interface MetricResp {
      _links: { query?: { href: string } };
      total: { name: string; series: Series[] };
      addons: { addonKey: string; series: Series[] }[];
    }

    it("metric=reason returns FLAT total.series grouped by reasonKey (no uniqueTotal)", async () => {
      const d = await client.callTool<MetricResp>("feedback_metrics_by_metric", {
        metric: "reason", startDate: "2026-01-01", endDate: "2026-04-01",
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

    it("metric=type series names are feedbackTypes (disable/uninstall/unsubscribe)", async () => {
      const d = await client.callTool<MetricResp>("feedback_metrics_by_metric", {
        metric: "type", startDate: "2026-01-01", endDate: "2026-04-01",
      });
      const names = d.total.series.map((s) => s.name).sort();
      for (const n of names) expect(["disable", "uninstall", "unsubscribe"]).toContain(n);
    });

    it("invalid metric is rejected by our Zod enum", async () => {
      const err = await client.callToolExpectingError("feedback_metrics_by_metric", { metric: "hosting" });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    it("aggregation=week returns more elements than aggregation=month", async () => {
      const week = await client.callTool<MetricResp>("feedback_metrics_by_metric", {
        metric: "reason", startDate: "2026-01-01", endDate: "2026-04-01", aggregation: "week",
      });
      const month = await client.callTool<MetricResp>("feedback_metrics_by_metric", {
        metric: "reason", startDate: "2026-01-01", endDate: "2026-04-01", aggregation: "month",
      });
      expect(week.total.series[0].elements.length).toBeGreaterThan(month.total.series[0].elements.length);
    });

    it("invalid aggregation is rejected by our Zod enum", async () => {
      const err = await client.callToolExpectingError("feedback_metrics_by_metric", {
        metric: "reason", aggregation: "daily",
      });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    it("schema exposes metric/aggregation/startDate/endDate (NOT productId/hosting)", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "feedback_metrics_by_metric")!;
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["aggregation", "endDate", "metric", "startDate"]);
    });
  });
});
