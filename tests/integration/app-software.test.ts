/**
 * Integration tests for App-listing + App-software tools.
 * Read tools exercised live; the 3 destructive writes (version_create/update,
 * token_create) verified statically only — never executed (they mutate the
 * vendor's published app software / mint credentials).
 * Tokens contain credential-adjacent data (token ids + customer cloud sites) —
 * tests assert structure only, never specific values.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";
import { discoverFixtures, type Fixtures } from "../helpers/fixtures.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface SoftwareEntry { appSoftwareId: string; hosting: string; complianceBoundaries: string[] | null; archived: boolean; }
interface VersionsResponse {
  links?: { self?: string; next?: string | null };
  versions: { buildNumber: number; versionNumber: string; supportedPaymentModel?: string }[];
  totalCount: number;
}

describe.skipIf(!hasLiveCreds())("Block E: App-listing & App-software (live API)", () => {
  let client: McpTestClient;
  let fx: Fixtures;
  let appSoftwareId: string | null = null;
  beforeAll(async () => {
    client = await McpTestClient.start();
    fx = await discoverFixtures(client);
    const arr = await client.callTool<SoftwareEntry[]>("app_software_get_by_appkey", {
      appKey: fx.primary.appKey, hosting: "cloud",
    });
    appSoftwareId = arr[0]?.appSoftwareId ?? null;
  });
  afterAll(async () => { await client.close(); });

  describe("app_listing_get", () => {
    it("returns product-listing metadata for one app", async () => {
      const d = await client.callTool<{ productId: string; appKey: string; state?: string; slug?: string }>(
        "app_listing_get", { productId: fx.primary.productId },
      );
      expect(d.productId).toBe(fx.primary.productId);
      expect(d.appKey).toEqual(expect.any(String));
    });

    it("requires productId (Zod)", async () => {
      const err = await client.callToolExpectingError("app_listing_get", {});
      expect(err.toLowerCase()).toMatch(/productid|required|invalid/);
    });
  });

  describe("app_software_get_by_appkey", () => {
    it("returns an ARRAY of {appSoftwareId, hosting, complianceBoundaries, archived} — one per hosting", async () => {
      const arr = await client.callTool<SoftwareEntry[]>("app_software_get_by_appkey", { appKey: fx.primary.appKey });
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBeGreaterThan(0);
      for (const e of arr) {
        expect(e.appSoftwareId).toMatch(UUID_RE);
        expect(["cloud", "server", "datacenter"]).toContain(e.hosting);
        // complianceBoundaries is a Cloud-only concept — an array for cloud,
        // null for server/datacenter (verified 2026-06-03).
        if (e.complianceBoundaries != null) expect(Array.isArray(e.complianceBoundaries)).toBe(true);
        expect(typeof e.archived).toBe("boolean");
      }
    });

    it("hosting filter narrows to that one platform; invalid hosting → Zod error", async () => {
      for (const hosting of ["cloud", "server", "datacenter"] as const) {
        const arr = await client.callTool<SoftwareEntry[]>("app_software_get_by_appkey", { appKey: fx.primary.appKey, hosting });
        for (const e of arr) expect(e.hosting).toBe(hosting);
      }
      const err = await client.callToolExpectingError("app_software_get_by_appkey", { appKey: fx.primary.appKey, hosting: "bogus" });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });
  });

  describe("app_software_versions_list", () => {
    it("returns {links, versions, totalCount} and is CURSOR-paginated (offset not supported)", async () => {
      if (!appSoftwareId) return;
      const d = await client.callTool<VersionsResponse>("app_software_versions_list", { appSoftwareId, limit: 3 });
      expect(Array.isArray(d.versions)).toBe(true);
      expect(d.versions.length).toBeLessThanOrEqual(3);
      expect(typeof d.totalCount).toBe("number");
      for (const v of d.versions) {
        expect(typeof v.buildNumber).toBe("number");
        expect(v.versionNumber).toEqual(expect.any(String));
      }
    });

    it("cursor paginates to a disjoint page", async () => {
      if (!appSoftwareId) return;
      const p1 = await client.callTool<VersionsResponse>("app_software_versions_list", { appSoftwareId, limit: 2 });
      const cursorMatch = /[?&]cursor=([^&]+)/.exec(p1.links?.next ?? "");
      if (!cursorMatch || p1.totalCount <= 2) return;
      const cursor = decodeURIComponent(cursorMatch[1]);
      const p2 = await client.callTool<VersionsResponse>("app_software_versions_list", { appSoftwareId, limit: 2, cursor });
      const b1 = new Set(p1.versions.map((v) => v.buildNumber));
      expect(p2.versions.some((v) => b1.has(v.buildNumber))).toBe(false);
    });

    it("paymentModel filters; invalid paymentModel → Zod error", async () => {
      if (!appSoftwareId) return;
      const d = await client.callTool<VersionsResponse>("app_software_versions_list", { appSoftwareId, paymentModel: "free", limit: 50 });
      expect(Array.isArray(d.versions)).toBe(true);
      const err = await client.callToolExpectingError("app_software_versions_list", { appSoftwareId, paymentModel: "bogus" });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    it("schema exposes cursor/state/paymentModel/parentSoftwareId (not offset)", async () => {
      const tools = await client.listTools();
      const props = (tools.find((x) => x.name === "app_software_versions_list")!.inputSchema as { properties: Record<string, unknown> }).properties;
      expect("cursor" in props).toBe(true);
      expect("paymentModel" in props).toBe(true);
      expect("state" in props).toBe(true);
      expect("offset" in props).toBe(false);
    });
  });

  describe("app_software_version_get", () => {
    it("fetches one version by buildNumber (chained from versions_list)", async () => {
      if (!appSoftwareId) return;
      const list = await client.callTool<VersionsResponse>("app_software_versions_list", { appSoftwareId, limit: 1 });
      const build = list.versions[0]?.buildNumber;
      if (build == null) return;
      const v = await client.callTool<{ buildNumber: number }>("app_software_version_get", { appSoftwareId, buildNumber: build });
      expect(v.buildNumber).toBe(build);
    });
  });

  describe("app_software_tokens_list", () => {
    it("returns {tokens:[{token, cloudId, instance}]} (structure only — credential-adjacent)", async () => {
      if (!appSoftwareId) return;
      const d = await client.callTool<{ tokens: { token: string; cloudId: string; instance: string }[] }>(
        "app_software_tokens_list", { appSoftwareId },
      );
      expect(Array.isArray(d.tokens)).toBe(true);
      for (const t of d.tokens.slice(0, 3)) {
        expect(t.token).toEqual(expect.any(String));
        expect(t.cloudId).toMatch(UUID_RE);
      }
    });
  });

  describe("write tools (static verification only — never executed)", () => {
    it("version_create / version_update / token_create are annotated destructive with the right required params", async () => {
      const tools = await client.listTools();
      const expected: Record<string, string[]> = {
        app_software_version_create: ["appSoftwareId", "body"],
        app_software_version_update: ["appSoftwareId", "body", "buildNumber"],
        app_software_token_create: ["appSoftwareId", "body"],
      };
      for (const [name, keys] of Object.entries(expected)) {
        const t = tools.find((x) => x.name === name)!;
        expect((t.annotations as { destructiveHint?: boolean }).destructiveHint).toBe(true);
        const props = Object.keys((t.inputSchema as { properties: Record<string, unknown> }).properties).sort();
        expect(props).toEqual(keys.sort());
      }
    });
  });
});
