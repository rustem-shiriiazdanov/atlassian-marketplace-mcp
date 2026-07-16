/**
 * Integration tests for partner_metrics_fetch (POST, body passthrough).
 * The body is a caller-supplied ReportingMetricTimeSeriesRequestBody; we verify
 * the tool forwards it, exposes limit/offset, and surfaces the API's validation
 * error clearly for a malformed body.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";

describe.skipIf(!hasLiveCreds())("Block F: Partner metrics (live API)", () => {
  let client: McpTestClient;
  beforeAll(async () => { client = await McpTestClient.start(); });
  afterAll(async () => { await client.close(); });

  describe("partner_metrics_fetch", () => {
    it("schema exposes developerId/limit/offset/body (limit+offset were the audit gap)", async () => {
      const tools = await client.listTools();
      const props = (tools.find((x) => x.name === "partner_metrics_fetch")!.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["body", "developerId", "limit", "offset"]);
    });

    it("forwards a malformed body and surfaces the API's 400 validation message (not a silent success)", async () => {
      // `metrics` as an array is the exact shape the API rejects — proves the body
      // reaches Atlassian and its validation error is surfaced.
      const err = await client.callToolExpectingError("partner_metrics_fetch", {
        body: { metrics: ["sales"], granularity: "month", dateRange: { start: "2026-01-01", end: "2026-04-01" } },
      });
      expect(err).toMatch(/HTTP 400|Invalid request body|metrics/i);
    });

    it("requires a body (Zod)", async () => {
      const err = await client.callToolExpectingError("partner_metrics_fetch", {});
      expect(err.toLowerCase()).toMatch(/body|required|invalid/);
    });
  });
});
