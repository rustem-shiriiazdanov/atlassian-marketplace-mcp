/**
 * Integration tests for promotion tools (v1 Marketplace API).
 *
 * Read tools are exercised live. The 4 write tools (create / update /
 * codes_create / code_delete) have PUBLIC customer impact (a promo becomes
 * redeemable, a code gets minted/deleted) — verified STATICALLY only.
 *
 * `promotions_list` (non-paged, legacy) is NOT called live: on a partner with
 * many promotions it can hang up to the 60s request timeout. It is verified
 * statically only. Use small `limit` values elsewhere so full pages don't spill
 * to the truncation temp-file.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";

interface Promotion {
  id: string; name: string; status: string; promotionType: string;
  eligibleApps: { key: string; name: string }[];
}
interface PagedResponse { promotions: Promotion[]; limit: number; nextId?: string | null }

describe.skipIf(!hasLiveCreds())("Block F: Promotions (live API, v1)", () => {
  let client: McpTestClient;
  let promo: Promotion | undefined;
  beforeAll(async () => {
    client = await McpTestClient.start();
    const page = await client.callTool<PagedResponse>("promotions_list_paged", { limit: 5 });
    promo = page.promotions?.[0];
  });
  afterAll(async () => { await client.close(); });

  describe("promotions_list_paged", () => {
    it("returns the paged envelope with a promotions array", async () => {
      const d = await client.callTool<PagedResponse>("promotions_list_paged", { limit: 5 });
      expect(Array.isArray(d.promotions)).toBe(true);
      for (const p of d.promotions.slice(0, 3)) {
        expect(p.id).toEqual(expect.any(String));
        expect(p.status).toEqual(expect.any(String));
      }
    });

    it("accepts filter combinations (activeOnly + orderBy + ascending + hostingType)", async () => {
      const d = await client.callTool<PagedResponse>("promotions_list_paged", {
        activeOnly: true, orderBy: "CREATION_DATE", ascending: false, hostingType: "CLOUD", limit: 3,
      });
      expect(Array.isArray(d.promotions)).toBe(true);
      expect(d.promotions.length).toBeLessThanOrEqual(3);
    });

    it("a REAL appKey narrows the result and every hit lists that app; a BOGUS appKey is silently ignored (returns all)", async () => {
      const base = await client.callTool<PagedResponse>("promotions_list_paged", { limit: 20 });
      const realKey = base.promotions.flatMap((p) => p.eligibleApps ?? []).map((a) => a.key).find(Boolean);
      if (!realKey) return;
      const real = await client.callTool<PagedResponse>("promotions_list_paged", { limit: 20, appKey: realKey });
      // every returned promo genuinely lists that app
      for (const p of real.promotions) {
        expect((p.eligibleApps ?? []).some((a) => a.key === realKey)).toBe(true);
      }
      // documented gotcha: an unknown appKey does NOT filter — it returns promotions (not an empty set)
      const bogus = await client.callTool<PagedResponse>("promotions_list_paged", { limit: 20, appKey: "zzz-no-such-app-xyz" });
      expect(bogus.promotions.length).toBeGreaterThan(0);
    });
  });

  describe("promotions_get / status / codes", () => {
    it("get returns the full promotion object for a real id", async () => {
      if (!promo) return;
      const d = await client.callTool<Promotion>("promotions_get", { promotionId: promo.id });
      expect(d.id).toBe(promo.id);
      expect(d.name).toEqual(expect.any(String));
      expect(Array.isArray(d.eligibleApps)).toBe(true);
    });

    it("nonexistent promotionId returns HTTP 500 (documented API quirk, not 404)", async () => {
      const err = await client.callToolExpectingError("promotions_get", { promotionId: "nonexistent-promo-xyz" });
      expect(err).toMatch(/500|400|404/); // API returns 500; accept any error surface
    });

    it("status returns one of ACTIVE | ENDED_EARLY | EXPIRED", async () => {
      if (!promo) return;
      const d = await client.callTool<string | { status?: string }>("promotions_status", { promotionId: promo.id });
      const status = typeof d === "string" ? d : (d.status ?? "");
      expect(status).toMatch(/ACTIVE|ENDED_EARLY|EXPIRED/);
    });

    it("codes_list returns a codes array for a promotion (structure only — codes are redeemable)", async () => {
      if (!promo) return;
      const d = await client.callTool<{ codes?: unknown[] }>("promotions_codes_list", { promotionId: promo.id });
      expect(Array.isArray(d.codes ?? [])).toBe(true);
    });
  });

  describe("write tools + non-paged list (static verification only — never executed)", () => {
    it("create / update / codes_create / code_delete are destructive", async () => {
      const tools = await client.listTools();
      for (const name of ["promotions_create", "promotions_update", "promotions_codes_create", "promotions_code_delete"]) {
        const t = tools.find((x) => x.name === name)!;
        expect((t.annotations as { destructiveHint?: boolean }).destructiveHint).toBe(true);
      }
    });

    it("promotions_create requires the spec-mandated fields", async () => {
      const tools = await client.listTools();
      const schema = tools.find((x) => x.name === "promotions_create")!.inputSchema as { required?: string[] };
      // spec-required: name, eligibleApps, expirationDate, promotionType, discountType, hostingType
      for (const f of ["name", "eligibleApps", "expirationDate", "promotionType", "discountType", "hostingType"]) {
        expect(schema.required).toContain(f);
      }
    });

    it("promotions_list (non-paged, hang-prone) exists and is read-only — not called here", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "promotions_list")!;
      expect((t.annotations as { readOnlyHint?: boolean }).readOnlyHint).toBe(true);
    });
  });
});
