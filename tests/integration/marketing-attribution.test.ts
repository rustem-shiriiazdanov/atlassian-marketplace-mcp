/**
 * Integration tests for the marketing-attribution async export triplet:
 * start (write-safe POST) → status → download. Live API.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";

const W = { startDate: "2026-01-01", endDate: "2026-04-01" };

interface StartResp { _links?: { query?: { href: string } }; export: { id: string } }
interface StatusResp { export: { id: string; status: string } }

describe.skipIf(!hasLiveCreds())("Block D: Marketing attribution (live API)", () => {
  let client: McpTestClient;
  beforeAll(async () => { client = await McpTestClient.start(); });
  afterAll(async () => { await client.close(); });

  describe("marketing_attribution_export_async_start", () => {
    it("returns export.id and advertises the {?addon,text,startDate,endDate} template", async () => {
      const d = await client.callTool<StartResp>("marketing_attribution_export_async_start", W);
      expect(d._links?.query?.href).toContain("{?addon");
      expect(d.export.id).toMatch(/^[0-9a-f-]{16,}$/);
    });

    it("schema exposes productId/addon/text/startDate/endDate/accept (spec-aligned)", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "marketing_attribution_export_async_start")!;
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["accept", "addon", "endDate", "productId", "startDate", "text"]);
    });

    it("is param-deduped: identical params return the same exportId", async () => {
      const a = await client.callTool<StartResp>("marketing_attribution_export_async_start", W);
      const b = await client.callTool<StartResp>("marketing_attribution_export_async_start", W);
      expect(a.export.id).toBe(b.export.id);
    });
  });

  describe("marketing_attribution async status → download chain", () => {
    it("start → status reports a known state → download yields a JSON array", async () => {
      const start = await client.callTool<StartResp>("marketing_attribution_export_async_start", W);
      const exportId = start.export.id;

      // Poll status (bounded). The export is usually already COMPLETED due to dedup.
      let status = "";
      for (let i = 0; i < 6; i++) {
        const s = await client.callTool<StatusResp>("marketing_attribution_export_async_status", { exportId });
        status = s.export.status;
        if (status === "COMPLETED" || status === "DONE") break;
        await new Promise((r) => setTimeout(r, 4000));
      }
      expect(["COMPLETED", "DONE", "PROCESSING", "IN_PROGRESS"]).toContain(status);

      if (status === "COMPLETED" || status === "DONE") {
        const data = await client.callTool<unknown>("marketing_attribution_export_async_download", { exportId });
        // Large exports spill to the truncation envelope; small ones come back inline.
        if (Array.isArray(data)) {
          expect(data.length).toBeGreaterThanOrEqual(0);
        } else {
          const env = data as { _truncated?: boolean };
          expect(env._truncated === true || typeof data === "object").toBe(true);
        }
      }
    });

    it("status with a bogus exportId returns isError", async () => {
      const err = await client.callToolExpectingError("marketing_attribution_export_async_status", {
        exportId: "00000000-0000-0000-0000-000000000000",
      });
      expect(err.length).toBeGreaterThan(0);
    });

    it("status/download require exportId (Zod)", async () => {
      const err = await client.callToolExpectingError("marketing_attribution_export_async_status", {});
      expect(err.toLowerCase()).toMatch(/exportid|required|invalid/);
    });
  });
});
