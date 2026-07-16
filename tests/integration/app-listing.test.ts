/**
 * Integration tests for the app-listing tools.
 *
 * `app_listing_get` (read) is exercised live. `app_listing_update` (PUT) has
 * PUBLIC marketplace impact — verified STATICALLY only, never executed.
 *
 * Note: enumerating all product listings is done via `apps_list`
 * (GET /product-listing/developer-space/{developerId}); there is deliberately
 * no separate list tool here to avoid duplicating it.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";
import { discoverFixtures, type Fixtures } from "../helpers/fixtures.js";

interface Listing {
  productId: string; appKey: string; developerId: string; appName: string;
  summary: string; tagLine: string; images: unknown; tags: unknown;
  state: string; slug: string; revision: unknown;
}

describe.skipIf(!hasLiveCreds())("Block F: App listing (live API)", () => {
  let client: McpTestClient;
  let fx: Fixtures;
  beforeAll(async () => {
    client = await McpTestClient.start();
    fx = await discoverFixtures(client);
  });
  afterAll(async () => { await client.close(); });

  describe("app_listing_get", () => {
    it("returns the documented rich listing envelope for a real app", async () => {
      const productId = fx.apps[0]?.productId;
      if (!productId) return;
      const d = await client.callTool<Listing>("app_listing_get", { productId });
      expect(d.productId).toBe(productId);
      expect(d.appKey).toEqual(expect.any(String));
      expect(d.appName).toEqual(expect.any(String));
      expect(d.summary).toEqual(expect.any(String));
      expect(d.tagLine).toEqual(expect.any(String));
      expect(d.slug).toEqual(expect.any(String));
      expect(d.state).toEqual(expect.any(String));
    });

    it("unknown productId surfaces a 404 error", async () => {
      const err = await client.callToolExpectingError("app_listing_get", {
        productId: "00000000-0000-0000-0000-000000000000",
      });
      expect(err).toMatch(/404|not found/i);
    });

    it("requires productId (Zod)", async () => {
      const err = await client.callToolExpectingError("app_listing_get", {});
      expect(err.toLowerCase()).toMatch(/productid|required|invalid/);
    });
  });

  describe("app_listing_update (static verification only — never executed)", () => {
    it("is destructive and takes {productId, body}", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "app_listing_update")!;
      expect((t.annotations as { destructiveHint?: boolean }).destructiveHint).toBe(true);
      const props = Object.keys((t.inputSchema as { properties: Record<string, unknown> }).properties).sort();
      expect(props).toEqual(["body", "productId"]);
    });

    it("does not expose a duplicate listing-enumeration tool (apps_list owns that endpoint)", async () => {
      const tools = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).not.toContain("app_listing_list");
      expect(names).toContain("apps_list");
    });
  });
});
