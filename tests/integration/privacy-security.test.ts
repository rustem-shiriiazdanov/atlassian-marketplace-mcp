/**
 * Integration tests for privacy_security_get (read). The 3 write tools
 * (draft_put, draft_delete, publish) alter published procurement info — verified
 * statically only, never executed.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";
import { discoverFixtures, type Fixtures } from "../helpers/fixtures.js";

describe.skipIf(!hasLiveCreds())("Block F: Privacy & security (live API)", () => {
  let client: McpTestClient;
  let fx: Fixtures;
  beforeAll(async () => {
    client = await McpTestClient.start();
    fx = await discoverFixtures(client);
  });
  afterAll(async () => { await client.close(); });

  describe("privacy_security_get", () => {
    it("state=live (default) returns {commonCloud:{...procurement fields}}", async () => {
      const d = await client.callTool<{ commonCloud?: Record<string, unknown> }>("privacy_security_get", {
        productId: fx.primary.productId,
      });
      expect(d.commonCloud).toBeDefined();
      // known sub-keys from the live shape
      const keys = Object.keys(d.commonCloud!);
      expect(keys).toEqual(expect.arrayContaining(["dataAccessAndStorage", "privacy", "security"]));
    });

    it("explicit state=live matches the default", async () => {
      const def = await client.callTool<{ commonCloud?: unknown }>("privacy_security_get", { productId: fx.primary.productId });
      const live = await client.callTool<{ commonCloud?: unknown }>("privacy_security_get", { productId: fx.primary.productId, state: "live" });
      expect(JSON.stringify(live)).toBe(JSON.stringify(def));
    });

    it("state=draft returns 404/error when no draft exists (surfaced, not silent)", async () => {
      const err = await client.callToolExpectingError("privacy_security_get", {
        productId: fx.primary.productId, state: "draft",
      });
      expect(err.length).toBeGreaterThan(0);
    });

    it("invalid state is rejected by our Zod enum", async () => {
      const err = await client.callToolExpectingError("privacy_security_get", {
        productId: fx.primary.productId, state: "bogus",
      });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    it("schema exposes productId + state only", async () => {
      const tools = await client.listTools();
      const props = (tools.find((x) => x.name === "privacy_security_get")!.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["productId", "state"]);
    });
  });
});
