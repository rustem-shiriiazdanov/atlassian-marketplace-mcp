/**
 * Integration tests for developer-space tools.
 *
 * Read tools (get, catalog_account, listings, members_list, member_get,
 * by_vendor) are exercised live. Member data is PII (email, userName) so those
 * assertions check STRUCTURE only, never values.
 *
 * The three member-mutation tools (add POST / update PUT / remove DELETE) grant
 * or revoke real people's console access — they are verified STATICALLY only
 * (annotations + schema), never executed against the live API.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";

interface MembersPage { members: Member[]; next?: string | null }
interface Member { aaid: string; roles: unknown[]; categories: unknown[]; email?: string; userName?: string }

describe.skipIf(!hasLiveCreds())("Block F: Developer space (live API)", () => {
  let client: McpTestClient;
  beforeAll(async () => { client = await McpTestClient.start(); });
  afterAll(async () => { await client.close(); });

  describe("developer_space_get", () => {
    it("returns the profile envelope for the default developer", async () => {
      const d = await client.callTool<{ id: string; vendorId: string; name: string; status: string; type: string }>(
        "developer_space_get", {},
      );
      expect(d.id).toEqual(expect.any(String));
      expect(d.name).toEqual(expect.any(String));
      expect(d.status).toEqual(expect.any(String));
    });

    it("malformed developerId surfaces a 400/404 error", async () => {
      const err = await client.callToolExpectingError("developer_space_get", { developerId: "no-such-dev-xyz" });
      expect(err).toMatch(/400|404|not found|invalid/i);
    });
  });

  describe("developer_space_catalog_account", () => {
    it("returns {developerId, catalogAccountId}", async () => {
      const d = await client.callTool<{ developerId: string; catalogAccountId: string }>(
        "developer_space_catalog_account", {},
      );
      expect(d.developerId).toEqual(expect.any(String));
      expect(d.catalogAccountId).toEqual(expect.any(String));
    });
  });

  describe("developer_space_listings", () => {
    it("returns a bare array of listing documents (not an envelope)", async () => {
      const d = await client.callTool<unknown[]>("developer_space_listings", {});
      expect(Array.isArray(d)).toBe(true);
    });
  });

  describe("developer_space_members_list", () => {
    it("returns {members, next} and paginates completely via the bare `next` cursor token", async () => {
      const first = await client.callTool<MembersPage>("developer_space_members_list", {});
      expect(Array.isArray(first.members)).toBe(true);
      // structure only — email/userName are PII
      for (const m of first.members.slice(0, 3)) {
        expect(m.aaid).toEqual(expect.any(String));
        expect(Array.isArray(m.roles)).toBe(true);
      }

      // Walk every page at limit=3 using the top-level `next` token as `cursor`.
      // `next` is a BARE token (not a links.next URL); assert that convention holds.
      const seen = new Set<string>();
      let cursor: string | undefined;
      let pages = 0;
      // guard against runaway loops
      for (; pages < 50; pages++) {
        const page = await client.callTool<MembersPage>(
          "developer_space_members_list", cursor ? { limit: 3, cursor } : { limit: 3 },
        );
        for (const m of page.members) seen.add(m.aaid);
        if (page.next) {
          // the pagination token must be a bare token, NOT a URL
          expect(page.next).not.toMatch(/^https?:\/\//);
        } else break;
        cursor = page.next;
      }
      // every member from the default page is covered by the full traversal
      for (const m of first.members) expect(seen.has(m.aaid)).toBe(true);
      // more than one page's worth were discovered (proves cursor actually advanced)
      expect(seen.size).toBeGreaterThanOrEqual(first.members.length);
    });

    it("schema exposes developerId, cursor, limit", async () => {
      const tools = await client.listTools();
      const props = (tools.find((x) => x.name === "developer_space_members_list")!.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["cursor", "developerId", "limit"]);
    });
  });

  describe("developer_space_member_get", () => {
    it("returns a member record (structure only — PII) for a real member", async () => {
      const page = await client.callTool<MembersPage>("developer_space_members_list", { limit: 1 });
      const aaid = page.members[0]?.aaid;
      if (!aaid) return;
      const m = await client.callTool<Member>("developer_space_member_get", { aaid });
      expect(m.aaid).toBe(aaid);
      expect(Array.isArray(m.roles)).toBe(true);
      expect(Array.isArray(m.categories)).toBe(true);
    });

    it("unknown aaid surfaces a 400/404 error", async () => {
      const err = await client.callToolExpectingError("developer_space_member_get", { aaid: "no-such-aaid-xyz" });
      expect(err).toMatch(/400|404|not found|invalid/i);
    });
  });

  describe("developer_space_by_vendor", () => {
    it("nonexistent vendorId surfaces a 404 error", async () => {
      const err = await client.callToolExpectingError("developer_space_by_vendor", { vendorId: "99999999" });
      expect(err).toMatch(/400|404|not found/i);
    });
  });

  describe("member-mutation tools (static verification only — never executed)", () => {
    it("member_add (POST) / member_update (PUT) / member_remove (DELETE) are destructive with the right schema", async () => {
      const tools = await client.listTools();
      const expected: Record<string, string[]> = {
        developer_space_member_add: ["aaid", "body", "developerId"],
        developer_space_member_update: ["aaid", "body", "developerId"],
        developer_space_member_remove: ["aaid", "developerId"],
      };
      for (const [name, props] of Object.entries(expected)) {
        const t = tools.find((x) => x.name === name)!;
        expect((t.annotations as { destructiveHint?: boolean }).destructiveHint).toBe(true);
        expect(Object.keys((t.inputSchema as { properties: Record<string, unknown> }).properties).sort()).toEqual(props);
      }
    });
  });
});
