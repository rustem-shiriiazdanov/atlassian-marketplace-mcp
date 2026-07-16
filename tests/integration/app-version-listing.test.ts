/**
 * Integration tests for App-version-listing tools.
 * 2 read tools exercised live (pagination + state/approvalStatus filters, incl.
 * combinations, payload-verified). 2 destructive writes (create/update) verified
 * statically only — never executed (they publish app versions to the Marketplace).
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";
import { discoverFixtures, type Fixtures } from "../helpers/fixtures.js";

interface VersionListing {
  buildNumber: number; state: string; approvalStatus: string;
  appSoftwareId: string; revision?: number;
}
interface ListAllResponse {
  links?: { self?: string; next?: string | null };
  versions: VersionListing[];
}

describe.skipIf(!hasLiveCreds())("Block E: App-version-listing (live API)", () => {
  let client: McpTestClient;
  let fx: Fixtures;
  let appSoftwareId: string | null = null;
  beforeAll(async () => {
    client = await McpTestClient.start();
    fx = await discoverFixtures(client);
    const arr = await client.callTool<{ appSoftwareId: string }[]>("app_software_get_by_appkey", {
      appKey: fx.primary.appKey, hosting: "cloud",
    });
    appSoftwareId = arr[0]?.appSoftwareId ?? null;
  });
  afterAll(async () => { await client.close(); });

  describe("app_version_listings_list_all", () => {
    it("returns {links, versions[...]} with the documented per-version fields", async () => {
      if (!appSoftwareId) return;
      const d = await client.callTool<ListAllResponse>("app_version_listings_list_all", { appSoftwareId, limit: 5 });
      expect(Array.isArray(d.versions)).toBe(true);
      expect(d.versions.length).toBeLessThanOrEqual(5);
      for (const v of d.versions) {
        expect(typeof v.buildNumber).toBe("number");
        expect(["PRIVATE", "PUBLIC"]).toContain(v.state);
        expect(["APPROVED", "SUBMITTED", "REJECTED", "UNINITIATED"]).toContain(v.approvalStatus);
      }
    });

    it("is CURSOR-paginated: cursor pages to a disjoint set of builds", async () => {
      if (!appSoftwareId) return;
      const p1 = await client.callTool<ListAllResponse>("app_version_listings_list_all", { appSoftwareId, limit: 3 });
      const m = /[?&]cursor=([^&]+)/.exec(p1.links?.next ?? "");
      if (!m) return; // only one page
      const cursor = decodeURIComponent(m[1]);
      const p2 = await client.callTool<ListAllResponse>("app_version_listings_list_all", { appSoftwareId, limit: 3, cursor });
      const b1 = new Set(p1.versions.map((v) => v.buildNumber));
      expect(p2.versions.some((v) => b1.has(v.buildNumber))).toBe(false);
    });

    it("state filter narrows every returned row (PUBLIC / PRIVATE)", async () => {
      if (!appSoftwareId) return;
      for (const state of ["PUBLIC", "PRIVATE"] as const) {
        const d = await client.callTool<ListAllResponse>("app_version_listings_list_all", { appSoftwareId, state, limit: 5 });
        for (const v of d.versions) expect(v.state).toBe(state);
      }
    });

    it("approvalStatus filter narrows every returned row", async () => {
      if (!appSoftwareId) return;
      const d = await client.callTool<ListAllResponse>("app_version_listings_list_all", {
        appSoftwareId, approvalStatus: "UNINITIATED", limit: 5,
      });
      for (const v of d.versions) expect(v.approvalStatus).toBe("UNINITIATED");
    });

    it("state + approvalStatus COMBINE: every row satisfies both constraints", async () => {
      if (!appSoftwareId) return;
      const d = await client.callTool<ListAllResponse>("app_version_listings_list_all", {
        appSoftwareId, state: "PUBLIC", approvalStatus: "UNINITIATED", limit: 5,
      });
      for (const v of d.versions) {
        expect(v.state).toBe("PUBLIC");
        expect(v.approvalStatus).toBe("UNINITIATED");
      }
    });

    it("invalid state/approvalStatus rejected by our Zod enum (endpoint would silently return empty)", async () => {
      const e1 = await client.callToolExpectingError("app_version_listings_list_all", { appSoftwareId: fx.primary.productId, state: "bogus" });
      expect(e1.toLowerCase()).toMatch(/invalid|enum|expected/);
      const e2 = await client.callToolExpectingError("app_version_listings_list_all", { appSoftwareId: fx.primary.productId, approvalStatus: "bogus" });
      expect(e2.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    it("schema exposes limit/cursor/state/approvalStatus", async () => {
      const tools = await client.listTools();
      const props = (tools.find((x) => x.name === "app_version_listings_list_all")!.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["appSoftwareId", "approvalStatus", "cursor", "limit", "state"]);
    });
  });

  describe("app_version_listing_get", () => {
    it("fetches one version-listing by buildNumber (chained)", async () => {
      if (!appSoftwareId) return;
      const list = await client.callTool<ListAllResponse>("app_version_listings_list_all", { appSoftwareId, limit: 1 });
      const build = list.versions[0]?.buildNumber;
      if (build == null) return;
      const v = await client.callTool<VersionListing>("app_version_listing_get", { appSoftwareId, buildNumber: build });
      expect(v.buildNumber).toBe(build);
      expect(["PRIVATE", "PUBLIC"]).toContain(v.state);
    });
  });

  describe("write tools (static verification only — never executed)", () => {
    it("create (POST) + update (PUT) are annotated destructive with appSoftwareId/buildNumber/body", async () => {
      const tools = await client.listTools();
      for (const name of ["app_version_listing_create", "app_version_listing_update"]) {
        const t = tools.find((x) => x.name === name)!;
        expect((t.annotations as { destructiveHint?: boolean }).destructiveHint).toBe(true);
        const props = Object.keys((t.inputSchema as { properties: Record<string, unknown> }).properties).sort();
        expect(props).toEqual(["appSoftwareId", "body", "buildNumber"]);
      }
    });
  });
});
