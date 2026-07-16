/**
 * Integration tests for the two read-only reporting entrypoint tools:
 *   - product_catalog_latest  (presigned URL to the public app-catalog CSV)
 *   - reporting_links         (HAL root listing every reporting link)
 * Both are exercised live.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";

describe.skipIf(!hasLiveCreds())("Block F: Reporting entrypoints (live API)", () => {
  let client: McpTestClient;
  beforeAll(async () => { client = await McpTestClient.start(); });
  afterAll(async () => { await client.close(); });

  describe("product_catalog_latest", () => {
    it("returns {date, presignedUrl, expiresInSeconds}", async () => {
      const d = await client.callTool<{ date: string; presignedUrl: string; expiresInSeconds: number }>(
        "product_catalog_latest", {},
      );
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.presignedUrl).toMatch(/^https:\/\//);
      expect(typeof d.expiresInSeconds).toBe("number");
      expect(d.expiresInSeconds).toBeGreaterThan(0);
    });

    it("presignedUrl serves the app-catalog CSV (ranged fetch of just the header row)", async () => {
      const d = await client.callTool<{ presignedUrl: string }>("product_catalog_latest", {});
      // The snapshot is ~150 MB — fetch only the first bytes via a Range header.
      const res = await fetch(d.presignedUrl, { headers: { Range: "bytes=0-300" } });
      expect(res.ok).toBe(true); // 200 or 206
      const head = await res.text();
      // it's a CSV of published apps, NOT JSON
      expect(head.trimStart().startsWith("{")).toBe(false);
      expect(head).toContain("product_id");
      expect(head).toContain("marketplace_app_key");
    }, 30_000);

    it("takes no input parameters", async () => {
      const tools = await client.listTools();
      const props = (tools.find((x) => x.name === "product_catalog_latest")!.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
      expect(Object.keys(props)).toEqual([]);
    });
  });

  describe("reporting_links", () => {
    it("returns a HAL root with a rich _links map", async () => {
      const d = await client.callTool<{ _links: Record<string, unknown> }>("reporting_links", {});
      expect(d._links).toBeTypeOf("object");
      const names = Object.keys(d._links);
      expect(names).toContain("self");
      // the reporting root exposes many report links
      expect(names.length).toBeGreaterThan(10);
    });

    it("takes no input parameters", async () => {
      const tools = await client.listTools();
      const props = (tools.find((x) => x.name === "reporting_links")!.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
      expect(Object.keys(props)).toEqual([]);
    });
  });
});
