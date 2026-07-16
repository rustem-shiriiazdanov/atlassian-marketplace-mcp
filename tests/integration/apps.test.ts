/**
 * Integration tests for the Apps discovery tools.
 *
 * Tools covered: apps_list, apps_known
 *
 * These tests hit the live Atlassian Marketplace API. They're skipped when
 * the env vars are absent, so the public-repo CI passes without secrets.
 * To run locally: ensure .env has ATLASSIAN_EMAIL/TOKEN/DEVELOPER_ID/PARTNER_ID,
 * then `npm run test`.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";

interface AppSummary {
  productId: string;
  appKey: string;
  appName: string;
  state?: string;
  approvalStatus?: string;
}
interface AppsListSummaryResponse {
  count: number;
  apps: AppSummary[];
  nextCursor?: string | null;
}
interface AppsListFullResponse {
  items: Array<AppSummary & { developerId: string; summary?: string; tagLine?: string }>;
  links?: unknown;
}

describe.skipIf(!hasLiveCreds())("Apps discovery tools (live API)", () => {
  let client: McpTestClient;
  beforeAll(async () => {
    client = await McpTestClient.start();
  });
  afterAll(async () => {
    await client.close();
  });

  describe("apps_list", () => {
    it("returns a summary by default", async () => {
      const data = await client.callTool<AppsListSummaryResponse>("apps_list");
      expect(data.count).toBeGreaterThan(0);
      expect(data.apps).toHaveLength(data.count);
      const first = data.apps[0];
      expect(first.productId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(first.appKey).toEqual(expect.any(String));
      expect(first.appName).toEqual(expect.any(String));
      expect(first.state).toEqual(expect.any(String));
      expect(first.approvalStatus).toEqual(expect.any(String));
    });

    it("explicit includeFullPayload=false matches default", async () => {
      const def = await client.callTool<AppsListSummaryResponse>("apps_list");
      const explicit = await client.callTool<AppsListSummaryResponse>("apps_list", {
        includeFullPayload: false,
      });
      expect(explicit.count).toBe(def.count);
      expect(explicit.apps.map((a) => a.productId).sort()).toEqual(
        def.apps.map((a) => a.productId).sort()
      );
    });

    it("includeFullPayload=true returns the raw {items, links} shape", async () => {
      const data = await client.callTool<AppsListFullResponse>("apps_list", {
        includeFullPayload: true,
      });
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThan(0);
      const first = data.items[0];
      // Full payload exposes far more fields than the summary
      expect(first.developerId).toMatch(/^[0-9a-f-]{36}$/);
      expect(first).toHaveProperty("summary");
      expect(first).toHaveProperty("tagLine");
    });

    it("summary count equals full-payload items count", async () => {
      const summary = await client.callTool<AppsListSummaryResponse>("apps_list");
      const full = await client.callTool<AppsListFullResponse>("apps_list", {
        includeFullPayload: true,
      });
      expect(summary.count).toBe(full.items.length);
    });

    it("rejects wrong type on includeFullPayload (Zod validation)", async () => {
      const err = await client.callToolExpectingError("apps_list", {
        includeFullPayload: "yes" as unknown as boolean,
      });
      expect(err).toMatch(/Input validation error|invalid_type|expected boolean/i);
    });

    // ─── cursor pagination (spec-audit finding: limit/cursor/includePrivate were missing) ───

    it("limit caps the page and yields a nextCursor when more pages remain", async () => {
      const all = await client.callTool<AppsListSummaryResponse>("apps_list");
      if (all.count <= 1) return; // can't paginate a single-app space
      const page = await client.callTool<AppsListSummaryResponse>("apps_list", { limit: 1 });
      expect(page.apps).toHaveLength(1);
      // more apps exist ⇒ a cursor is returned
      expect(page.nextCursor).toEqual(expect.any(String));
    });

    it("cursor paginates to a disjoint page; full traversal covers every app", async () => {
      const all = await client.callTool<AppsListSummaryResponse>("apps_list", { limit: 50 });
      if (all.count <= 1) return;
      const seen = new Set<string>();
      let cursor: string | null | undefined;
      let pages = 0;
      do {
        const page = await client.callTool<AppsListSummaryResponse>("apps_list", cursor ? { limit: 2, cursor } : { limit: 2 });
        for (const a of page.apps) {
          expect(seen.has(a.productId), `duplicate app across pages: ${a.productId}`).toBe(false);
          seen.add(a.productId);
        }
        cursor = page.nextCursor;
      } while (cursor && ++pages < 100);
      // paged traversal saw exactly the same set as a single large page
      expect(seen.size).toBe(all.count);
    });

    it("last page has nextCursor === null", async () => {
      const all = await client.callTool<AppsListSummaryResponse>("apps_list", { limit: 50 });
      // a page big enough to hold everything is the last page
      expect(all.nextCursor ?? null).toBeNull();
    });

    it("limit=0 is rejected by our Zod min(1)", async () => {
      const err = await client.callToolExpectingError("apps_list", { limit: 0 });
      expect(err.toLowerCase()).toMatch(/invalid|min|greater|expected/);
    });

    it("includePrivate is accepted (boolean); invalid type rejected by Zod", async () => {
      const ok = await client.callTool<AppsListSummaryResponse>("apps_list", { includePrivate: true });
      expect(ok.count).toBeGreaterThan(0);
      const err = await client.callToolExpectingError("apps_list", {
        includePrivate: "bogus" as unknown as boolean,
      });
      expect(err.toLowerCase()).toMatch(/invalid|boolean|expected/);
    });

    it("schema exposes includeFullPayload/limit/cursor/includePrivate", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "apps_list")!;
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["cursor", "includeFullPayload", "includePrivate", "limit"]);
    });

    it("silently ignores unknown extra args (current Zod behavior — loose)", async () => {
      // This documents current behavior: extra args don't cause errors.
      // If we ever want strict mode, this test will need to flip.
      const data = await client.callTool<AppsListSummaryResponse>("apps_list", {
        nonsense: true,
        anotherUnknownField: 42,
      } as Record<string, unknown>);
      expect(data.count).toBeGreaterThan(0);
    });
  });

  describe("apps_known", () => {
    it("returns the PRODUCT_ID_* env map", async () => {
      const data = await client.callTool<Record<string, string>>("apps_known");
      expect(typeof data).toBe("object");
      // The map should contain at least the entries from the .env file used in dev.
      // We only assert there's something here; the specific keys are env-dependent.
      const entries = Object.entries(data);
      expect(entries.length).toBeGreaterThan(0);
      // Every value should be a UUID-shaped string (productId)
      for (const [name, productId] of entries) {
        expect(name).toMatch(/^[a-z_]+$/);
        expect(productId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      }
    });

    it("each known productId resolves to a real app in apps_list", async () => {
      const known = await client.callTool<Record<string, string>>("apps_known");
      const list = await client.callTool<AppsListSummaryResponse>("apps_list");
      const liveIds = new Set(list.apps.map((a) => a.productId));
      // Identify env entries that don't match the current developer-space.
      const orphans = Object.entries(known).filter(([, id]) => !liveIds.has(id));
      // We deliberately allow `_LEGACY`-suffixed entries to refer to a different dev space.
      const realOrphans = orphans.filter(([name]) => !name.endsWith("_legacy"));
      expect(realOrphans).toEqual([]);
    });
  });
});
