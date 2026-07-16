/**
 * Integration tests for cloud-migration-compatibility tools.
 * `compat_get` (read) exercised live; `compat_create` (PUT) / `compat_update`
 * (PATCH) are destructive (overwrite published migration info) — verified
 * statically only, never executed.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";
import { discoverFixtures, type Fixtures } from "../helpers/fixtures.js";

interface CompatInfo {
  developerId: string; productId: string; addonKey: string; addonName: string;
  cloudMigrationAssistantCompatibility: string; migrationPath: string; isDualLicenseOptedIn: boolean;
}

describe.skipIf(!hasLiveCreds())("Block F: Cloud migration compatibility (live API)", () => {
  let client: McpTestClient;
  let fx: Fixtures;
  let productWithCompat: string | null = null;
  beforeAll(async () => {
    client = await McpTestClient.start();
    fx = await discoverFixtures(client);
    // Not every app has a migration-compat record (many 404). Find one that does.
    for (const app of fx.apps) {
      try {
        await client.callTool<CompatInfo>("cloud_migration_compat_get", { productId: app.productId });
        productWithCompat = app.productId;
        break;
      } catch { /* 404 — try next */ }
    }
  });
  afterAll(async () => { await client.close(); });

  describe("cloud_migration_compat_get", () => {
    it("returns the documented compat fields for an app that has a record", async () => {
      if (!productWithCompat) return; // no app in this space has migration compat info
      const d = await client.callTool<CompatInfo>("cloud_migration_compat_get", { productId: productWithCompat });
      expect(d.productId).toBe(productWithCompat);
      expect(d.addonKey).toEqual(expect.any(String));
      expect(d.addonName).toEqual(expect.any(String));
      expect(d.cloudMigrationAssistantCompatibility).toEqual(expect.any(String));
      expect(d.migrationPath).toEqual(expect.any(String));
      expect(typeof d.isDualLicenseOptedIn).toBe("boolean");
    });

    it("surfaces a 404 error (not a silent empty) for an app with no compat record", async () => {
      // A valid-shape but non-existent productId has no record.
      const err = await client.callToolExpectingError("cloud_migration_compat_get", {
        productId: "00000000-0000-0000-0000-000000000000",
      });
      expect(err).toMatch(/404|not found/i);
    });

    it("requires productId (Zod)", async () => {
      const err = await client.callToolExpectingError("cloud_migration_compat_get", {});
      expect(err.toLowerCase()).toMatch(/productid|required|invalid/);
    });

    it("schema exposes productId only (no query params per spec)", async () => {
      const tools = await client.listTools();
      const props = (tools.find((x) => x.name === "cloud_migration_compat_get")!.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props)).toEqual(["productId"]);
    });
  });

  describe("write tools (static verification only — never executed)", () => {
    it("compat_create (PUT) + compat_update (PATCH) are destructive with productId/body", async () => {
      const tools = await client.listTools();
      for (const name of ["cloud_migration_compat_create", "cloud_migration_compat_update"]) {
        const t = tools.find((x) => x.name === name)!;
        expect((t.annotations as { destructiveHint?: boolean }).destructiveHint).toBe(true);
        const props = Object.keys((t.inputSchema as { properties: Record<string, unknown> }).properties).sort();
        expect(props).toEqual(["body", "productId"]);
      }
    });
  });
});
