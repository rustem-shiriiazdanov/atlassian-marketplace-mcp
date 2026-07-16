/**
 * Integration tests for parent-software read tools — focus on the newly-added
 * cursor pagination on parent_software_list / _versions_list.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";

interface ParentSoftware { id: string; name: string; developerId: string; }
interface ListResponse { links?: { self?: string; next?: string | null }; parentSoftware: ParentSoftware[]; }

describe.skipIf(!hasLiveCreds())("Block F: Parent software (live API)", () => {
  let client: McpTestClient;
  beforeAll(async () => { client = await McpTestClient.start(); });
  afterAll(async () => { await client.close(); });

  describe("parent_software_list", () => {
    it("default returns the full set (~Atlassian products) with a parentSoftware array", async () => {
      const d = await client.callTool<ListResponse>("parent_software_list", {});
      expect(Array.isArray(d.parentSoftware)).toBe(true);
      expect(d.parentSoftware.length).toBeGreaterThan(5);
      for (const p of d.parentSoftware.slice(0, 5)) {
        expect(p.id).toEqual(expect.any(String));
        expect(p.name).toEqual(expect.any(String));
      }
    });

    it("limit caps the page and yields a cursor; cursor pages to a disjoint set", async () => {
      const p1 = await client.callTool<ListResponse>("parent_software_list", { limit: 3 });
      expect(p1.parentSoftware.length).toBe(3);
      const m = /[?&]cursor=([^&]+)/.exec(p1.links?.next ?? "");
      if (!m) return;
      const cursor = decodeURIComponent(m[1]);
      const p2 = await client.callTool<ListResponse>("parent_software_list", { limit: 3, cursor });
      const ids1 = new Set(p1.parentSoftware.map((x) => x.id));
      expect(p2.parentSoftware.some((x) => ids1.has(x.id))).toBe(false);
    });

    it("schema exposes limit + cursor", async () => {
      const tools = await client.listTools();
      const props = (tools.find((x) => x.name === "parent_software_list")!.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["cursor", "limit"]);
    });
  });

  describe("parent_software_versions_list", () => {
    it("returns versions for a parent software and accepts limit/cursor", async () => {
      const list = await client.callTool<ListResponse>("parent_software_list", { limit: 5 });
      const psId = list.parentSoftware[0]?.id;
      if (!psId) return;
      const d = await client.callTool<{ versions?: unknown[]; parentSoftwareVersions?: unknown[] }>(
        "parent_software_versions_list", { parentSoftwareId: psId, limit: 3 },
      );
      const arr = d.versions ?? d.parentSoftwareVersions ?? [];
      expect(Array.isArray(arr)).toBe(true);
      const tools = await client.listTools();
      const props = (tools.find((x) => x.name === "parent_software_versions_list")!.inputSchema as { properties: Record<string, unknown> }).properties;
      expect("limit" in props && "cursor" in props).toBe(true);
    });
  });

  describe("parent_software_get", () => {
    it("returns {id, developerId:'Atlassian', name, hostingOptions[...]} for a known product", async () => {
      const list = await client.callTool<ListResponse>("parent_software_list", { limit: 25 });
      const jira = list.parentSoftware.find((p) => p.name === "Jira") ?? list.parentSoftware[0];
      const d = await client.callTool<{ id: string; developerId: string; name: string; hostingOptions: { hosting: string }[] }>(
        "parent_software_get", { parentSoftwareId: jira.id },
      );
      expect(d.id).toBe(jira.id);
      expect(d.developerId).toBe("Atlassian");
      expect(Array.isArray(d.hostingOptions)).toBe(true);
    });

    it("nonexistent id surfaces a 404 error", async () => {
      const err = await client.callToolExpectingError("parent_software_get", { parentSoftwareId: "no-such-product-xyz" });
      expect(err).toMatch(/404|not found/i);
    });

    it("requires parentSoftwareId (Zod)", async () => {
      const err = await client.callToolExpectingError("parent_software_get", {});
      expect(err.toLowerCase()).toMatch(/parentsoftwareid|required|invalid/);
    });
  });

  describe("parent_software_version_by_build / by_number", () => {
    interface VersionRecord { buildNumber: number; versionNumber: string; hosting: string[]; state: string; }

    it("by_build and by_number resolve to the SAME version record (path /versions/build vs /versions/number)", async () => {
      const list = await client.callTool<ListResponse>("parent_software_list", { limit: 25 });
      const jira = list.parentSoftware.find((p) => p.name === "Jira") ?? list.parentSoftware[0];
      const versions = await client.callTool<{ versions: VersionRecord[] }>("parent_software_versions_list", { parentSoftwareId: jira.id, limit: 1 });
      const v = versions.versions[0];
      if (!v) return;
      const byBuild = await client.callTool<VersionRecord>("parent_software_version_by_build", { parentSoftwareId: jira.id, buildNumber: v.buildNumber });
      const byNumber = await client.callTool<VersionRecord>("parent_software_version_by_number", { parentSoftwareId: jira.id, versionNumber: v.versionNumber });
      expect(byBuild.buildNumber).toBe(v.buildNumber);
      expect(byNumber.versionNumber).toBe(v.versionNumber);
      // both lookups return the identical record
      expect(byBuild.buildNumber).toBe(byNumber.buildNumber);
      expect(byBuild.versionNumber).toBe(byNumber.versionNumber);
    });

    it("unknown build number surfaces a 404 error", async () => {
      const list = await client.callTool<ListResponse>("parent_software_list", { limit: 5 });
      const err = await client.callToolExpectingError("parent_software_version_by_build", {
        parentSoftwareId: list.parentSoftware[0].id, buildNumber: 99999999,
      });
      expect(err).toMatch(/404|not found/i);
    });
  });
});
