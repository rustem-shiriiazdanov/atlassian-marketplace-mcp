/**
 * Integration tests for app_requests_and_approvals. Live API.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";
import { discoverFixtures, type Fixtures } from "../helpers/fixtures.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const W = { startDate: "2024-01-01", endDate: "2026-06-01" };

interface MonthRow { date: string; appRequests: number; appRequestsApproved: number; appRequestsApprovalRate: number; }
interface Resp {
  _links: { query?: { href: string } };
  total: { name: string; appRequestsAndApprovalsPerMonth: MonthRow[] };
  addons: { addonKey: string; productId: string; appRequestsAndApprovalsPerAppPerMonth: MonthRow[] }[];
}

describe.skipIf(!hasLiveCreds())("Block D: App requests & approvals (live API)", () => {
  let client: McpTestClient;
  let fx: Fixtures;
  beforeAll(async () => {
    client = await McpTestClient.start();
    fx = await discoverFixtures(client);
  });
  afterAll(async () => { await client.close(); });

  describe("app_requests_and_approvals", () => {
    it("returns total.appRequestsAndApprovalsPerMonth + addons with documented row fields", async () => {
      const d = await client.callTool<Resp>("app_requests_and_approvals", W);
      expect(d._links?.query?.href).toContain("{?addon");
      expect(Array.isArray(d.total.appRequestsAndApprovalsPerMonth)).toBe(true);
      for (const r of d.total.appRequestsAndApprovalsPerMonth) {
        expect(r.date).toMatch(ISO_DATE);
        expect(typeof r.appRequests).toBe("number");
        expect(typeof r.appRequestsApproved).toBe("number");
        expect(typeof r.appRequestsApprovalRate).toBe("number");
        // approved never exceeds requested
        expect(r.appRequestsApproved).toBeLessThanOrEqual(r.appRequests);
      }
      for (const a of d.addons) {
        expect(a.productId).toMatch(UUID_RE);
        expect(Array.isArray(a.appRequestsAndApprovalsPerAppPerMonth)).toBe(true);
      }
    });

    it("productId narrows to that one app", async () => {
      const d = await client.callTool<Resp>("app_requests_and_approvals", { ...W, productId: fx.primary.productId });
      expect(d.addons.length).toBe(1);
      expect(d.addons[0].productId).toBe(fx.primary.productId);
    });

    it("addon narrows to that one app", async () => {
      const d = await client.callTool<Resp>("app_requests_and_approvals", { ...W, addon: fx.primary.appKey });
      expect(d.addons.length).toBe(1);
      expect(d.addons[0].addonKey).toBe(fx.primary.appKey);
    });

    it("schema exposes productId/addon/startDate/endDate only (no pagination/hosting)", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "app_requests_and_approvals")!;
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["addon", "endDate", "productId", "startDate"]);
    });

    it("invalid date → 400; reversed range → empty addons", async () => {
      const err = await client.callToolExpectingError("app_requests_and_approvals", { startDate: "bad" });
      expect(err.toLowerCase()).toMatch(/date/);
      const d = await client.callTool<Resp>("app_requests_and_approvals", { startDate: "2026-06-01", endDate: "2026-01-01" });
      expect(d.addons).toEqual([]);
    });
  });
});
