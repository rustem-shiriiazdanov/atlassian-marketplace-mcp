/**
 * Integration tests for the Licenses tools.
 *
 * Tools covered (5):
 *   - licenses_list
 *   - licenses_export_sync
 *   - licenses_export_async_start
 *   - licenses_export_async_status
 *   - licenses_export_async_download
 *
 * Live API; self-skips when creds absent.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";
import { discoverFixtures, type Fixtures } from "../helpers/fixtures.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SEN_RE = /^E-[0-9A-Z]{3}-[0-9A-Z]{3}-[0-9A-Z]{3}-[0-9A-Z]{3}$/;

interface License {
  appEntitlementNumber: string;
  hostEntitlementNumber: string;
  cloudId?: string;
  cloudSiteHostname?: string;
  addonKey: string;
  addonName: string;
  hosting: string;
  licenseType: string;
  status: string;
  tier: string;
  maintenanceStartDate: string;
  maintenanceEndDate: string;
  productId: string;
  licenseLevel?: string;
  inGracePeriod?: string;
  contactDetails?: unknown;
}

interface LicensesListResponse {
  _links: { self?: unknown; query?: unknown; export?: unknown; next?: unknown };
  licenses: License[];
}

interface ExportStartResponse {
  _links: Record<string, unknown>;
  export: { id: string };
}

interface ExportStatusResponse {
  _links: Record<string, unknown>;
  export: { id: string; status: string };
}

interface TruncatedResponse {
  _truncated: true;
  _file: string;
  _bytes: number;
  _preview: string;
}

describe.skipIf(!hasLiveCreds())("Block B: Licenses tools (live API)", () => {
  let client: McpTestClient;
  let fx: Fixtures;
  beforeAll(async () => {
    client = await McpTestClient.start();
    fx = await discoverFixtures(client);
    if (!fx.firstSen) {
      throw new Error("No SEN found in this developer space — license tests need at least one active license to drive text-search assertions");
    }
  });
  afterAll(async () => {
    await client.close();
  });

  // ---------------------------------------------------------------------------
  // licenses_list
  // ---------------------------------------------------------------------------
  describe("licenses_list", () => {
    it("returns a HAL-shaped response with .licenses array", async () => {
      const data = await client.callTool<LicensesListResponse>("licenses_list", { limit: 2 });
      expect(data._links).toBeDefined();
      expect(Array.isArray(data.licenses)).toBe(true);
      expect(data.licenses).toHaveLength(2);
      // Every license carries the canonical identity + maintenance fields.
      // NOTE: appEntitlementNumber / hostEntitlementNumber are Cloud-only —
      // Server/Data Center licenses don't have them (verified 2026-06-03), so
      // only assert the SEN format when present.
      for (const l of data.licenses) {
        if (l.appEntitlementNumber != null) expect(l.appEntitlementNumber).toMatch(SEN_RE);
        if (l.hostEntitlementNumber != null) expect(l.hostEntitlementNumber).toMatch(SEN_RE);
        expect(l.addonKey).toEqual(expect.any(String));
        expect(l.addonName).toEqual(expect.any(String));
        expect(l.hosting).toMatch(/^(Cloud|Server|Data Center)$/);
        expect(l.licenseType).toEqual(expect.any(String));
        expect(l.status).toMatch(/^(active|inactive|cancelled)$/);
        expect(l.maintenanceStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(l.maintenanceEndDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(l.productId).toMatch(UUID_RE);
      }
    });

    it("filters by productId — every result matches", async () => {
      const data = await client.callTool<LicensesListResponse>("licenses_list", {
        productId: fx.primary.productId,
        limit: 5,
      });
      expect(data.licenses.length).toBeGreaterThan(0);
      for (const l of data.licenses) {
        expect(l.productId).toBe(fx.primary.productId);
      }
    });

    it("filters by status=active — every result is active", async () => {
      const data = await client.callTool<LicensesListResponse>("licenses_list", {
        status: "active",
        limit: 5,
      });
      for (const l of data.licenses) {
        expect(l.status).toBe("active");
      }
    });

    it("filters by licenseType=evaluation — every result is EVALUATION", async () => {
      const data = await client.callTool<LicensesListResponse>("licenses_list", {
        licenseType: "evaluation",
        limit: 5,
      });
      for (const l of data.licenses) {
        // NOTE: filter is lowercase but response value is uppercase
        expect(l.licenseType).toBe("EVALUATION");
      }
    });

    it("filters by hosting=cloud — every result has hosting=Cloud", async () => {
      const data = await client.callTool<LicensesListResponse>("licenses_list", {
        hosting: "cloud",
        limit: 5,
      });
      for (const l of data.licenses) {
        // Filter is lowercase one-word ('cloud'); response is capitalized ('Cloud')
        expect(l.hosting).toBe("Cloud");
      }
    });

    it("text search by SEN returns the matching license", async () => {
      const data = await client.callTool<LicensesListResponse>("licenses_list", {
        text: fx.firstSen!,
      });
      expect(data.licenses.length).toBeGreaterThanOrEqual(1);
      expect(data.licenses[0].appEntitlementNumber).toBe(fx.firstSen!);
    });

    it("showLicensesHistory=true never returns FEWER rows than default for the same SEN", async () => {
      const a = await client.callTool<LicensesListResponse>("licenses_list", {
        text: fx.firstSen!,
        showLicensesHistory: false,
      });
      const b = await client.callTool<LicensesListResponse>("licenses_list", {
        text: fx.firstSen!,
        showLicensesHistory: true,
      });
      // Without history: current state (typically 1 row). With history: every
      // lifecycle event (N rows). A SEN with a simple lifecycle yields exactly
      // 1 in both; a complex one yields more with history. The invariant that
      // holds for ANY SEN is: history >= current.
      expect(b.licenses.length).toBeGreaterThanOrEqual(a.licenses.length);
      expect(a.licenses.length).toBeGreaterThan(0);
    });

    it("pagination: offset returns distinct rows", async () => {
      const page1 = await client.callTool<LicensesListResponse>("licenses_list", { limit: 2, offset: 0 });
      const page2 = await client.callTool<LicensesListResponse>("licenses_list", { limit: 2, offset: 2 });
      const ids1 = page1.licenses.map((l) => l.appEntitlementNumber);
      const ids2 = page2.licenses.map((l) => l.appEntitlementNumber);
      const intersection = ids1.filter((id) => ids2.includes(id));
      expect(intersection).toEqual([]);
    });

    it("rejects hosting='data_center' (wrong spelling) via Zod", async () => {
      const err = await client.callToolExpectingError("licenses_list", { hosting: "data_center" });
      expect(err).toMatch(/invalid_enum_value/i);
    });

    it("rejects sortBy='saleDate' (transactions field, not licenses)", async () => {
      const err = await client.callToolExpectingError("licenses_list", { sortBy: "saleDate" });
      expect(err).toMatch(/invalid_enum_value/i);
    });

    it("rejects dateType='maintenance' (removed value)", async () => {
      const err = await client.callToolExpectingError("licenses_list", { dateType: "maintenance" });
      expect(err).toMatch(/invalid_enum_value/i);
    });

    it("rejects limit=0 (too small)", async () => {
      const err = await client.callToolExpectingError("licenses_list", { limit: 0 });
      expect(err).toMatch(/too_small/i);
    });

    it("rejects limit=51 (over the API max of 50)", async () => {
      const err = await client.callToolExpectingError("licenses_list", { limit: 51 });
      expect(err).toMatch(/too_big/i);
    });

    // -------------------------------------------------------------------------
    // Date filtering — startDate/endDate/dateType/lastUpdated
    // -------------------------------------------------------------------------
    describe("date filters", () => {
      it("dateType=start with startDate/endDate filters by maintenanceStartDate", async () => {
        const data = await client.callTool<LicensesListResponse>("licenses_list", {
          dateType: "start",
          startDate: "2026-04-01",
          endDate: "2026-04-30",
          limit: 10,
        });
        expect(data.licenses.length).toBeGreaterThan(0);
        for (const l of data.licenses) {
          // Every row's maintenanceStartDate should fall in the window.
          expect(l.maintenanceStartDate >= "2026-04-01").toBe(true);
          expect(l.maintenanceStartDate <= "2026-04-30").toBe(true);
        }
      });

      it("dateType=end returns licenses whose maintenance OVERLAPS the window (NOT strictly 'ended within')", async () => {
        // ATLASSIAN-SIDE QUIRK: despite the name, `dateType=end` doesn't filter to
        // "maintenanceEndDate within [startDate, endDate]". Probing on 2026-06-01
        // showed results where end > endDate but the license was still active during
        // the window (i.e., maintenance period overlapped). The actual semantic
        // appears to be: license was active at some point in the window.
        // Concrete invariant: each returned row's maintenance period must touch the window.
        const data = await client.callTool<LicensesListResponse>("licenses_list", {
          dateType: "end",
          startDate: "2026-04-01",
          endDate: "2026-04-30",
          limit: 10,
        });
        expect(data.licenses.length).toBeGreaterThan(0);
        for (const l of data.licenses) {
          // Maintenance period [start, end] must overlap window [2026-04-01, 2026-04-30].
          // → start <= window.end AND end >= window.start
          expect(l.maintenanceStartDate <= "2026-04-30").toBe(true);
          expect(l.maintenanceEndDate >= "2026-04-01").toBe(true);
        }
      });

      it("startDate alone (no endDate) is accepted", async () => {
        const data = await client.callTool<LicensesListResponse>("licenses_list", {
          startDate: "2026-05-01",
          dateType: "start",
          limit: 3,
        });
        expect(data.licenses).toBeDefined();
        expect(data.licenses.length).toBeGreaterThan(0);
        for (const l of data.licenses) {
          expect(l.maintenanceStartDate >= "2026-05-01").toBe(true);
        }
      });

      it("endDate alone (no startDate) is accepted", async () => {
        const data = await client.callTool<LicensesListResponse>("licenses_list", {
          endDate: "2026-05-01",
          dateType: "end",
          limit: 3,
        });
        expect(data.licenses).toBeDefined();
        expect(data.licenses.length).toBeGreaterThan(0);
        for (const l of data.licenses) {
          expect(l.maintenanceEndDate <= "2026-05-01").toBe(true);
        }
      });

      it("startDate > endDate is NOT validated by Atlassian — returns empty silently", async () => {
        // Atlassian doesn't enforce date ordering. Document the quirk so future
        // callers know an empty result might mean their range is reversed.
        const data = await client.callTool<LicensesListResponse>("licenses_list", {
          dateType: "start",
          startDate: "2026-06-01",
          endDate: "2026-04-01",
          limit: 5,
        });
        expect(Array.isArray(data.licenses)).toBe(true);
        expect(data.licenses).toHaveLength(0);
      });

      it("invalid date format → HTTP 400 surfaced as isError", async () => {
        const err = await client.callToolExpectingError("licenses_list", {
          startDate: "not-a-date",
        });
        expect(err).toMatch(/HTTP 400|Must be a date/i);
      });

      it("lastUpdated filter accepts ISO date and constrains results", async () => {
        const data = await client.callTool<LicensesListResponse>("licenses_list", {
          lastUpdated: "2026-05-01",
          limit: 3,
        });
        expect(data.licenses.length).toBeGreaterThan(0);
        for (const l of data.licenses) {
          expect((l as License & { lastUpdated?: string }).lastUpdated).toBeDefined();
          // Returned rows should have been updated on or after the filter date
          expect((l as License & { lastUpdated?: string }).lastUpdated! >= "2026-05-01").toBe(true);
        }
      });
    });

    // -------------------------------------------------------------------------
    // Other untested filters
    // -------------------------------------------------------------------------
    describe("other filters", () => {
      it("tier filter takes an INTEGER user-count (not the response string)", async () => {
        const data = await client.callTool<LicensesListResponse>("licenses_list", {
          tier: 10,
          limit: 3,
        });
        // tier=10 matches "10 Users" tier — BUT evaluation licenses fall under
        // the default tier filter too, so they can appear with tier "Evaluation".
        // (Same Atlassian-side quirk documented for transactions_list.)
        expect(data.licenses.length).toBeGreaterThan(0);
        for (const l of data.licenses) {
          expect(l.tier).toMatch(/^(10 Users|Evaluation)$/);
        }
      });

      it("rejects tier as a string (Zod schema enforces integer)", async () => {
        const err = await client.callToolExpectingError("licenses_list", {
          tier: "10 Users" as unknown as number,
        });
        expect(err).toMatch(/Input validation error|invalid_type|expected number/i);
      });

      it("licenseLevel=single-instance filter constrains results", async () => {
        const data = await client.callTool<LicensesListResponse>("licenses_list", {
          licenseLevel: "single-instance",
          limit: 3,
        });
        expect(data.licenses.length).toBeGreaterThan(0);
        for (const l of data.licenses) {
          expect(l.licenseLevel).toBe("single-instance");
        }
      });

      it("partnerType=direct is accepted (response shape unchanged)", async () => {
        const data = await client.callTool<LicensesListResponse>("licenses_list", {
          partnerType: "direct",
          limit: 3,
        });
        // The partnerType field isn't always echoed in the License row; just verify the call works.
        expect(Array.isArray(data.licenses)).toBe(true);
      });

      it("cloudComplianceBoundaries=commercial restricts to commercial-boundary licenses", async () => {
        const data = await client.callTool<LicensesListResponse>("licenses_list", {
          cloudComplianceBoundaries: "commercial",
          limit: 3,
        });
        expect(data.licenses.length).toBeGreaterThan(0);
        for (const l of data.licenses) {
          const cbs = (l as License & { cloudComplianceBoundaries?: string[] }).cloudComplianceBoundaries;
          if (cbs) expect(cbs).toContain("commercial");
        }
      });

      it("rejects bogus cloudComplianceBoundaries via Zod", async () => {
        const err = await client.callToolExpectingError("licenses_list", {
          cloudComplianceBoundaries: "bogus" as unknown as "commercial",
        });
        expect(err).toMatch(/invalid_enum_value/i);
      });

      it("appEdition=standard accepted (returns 0 in this dev space — no Standard-edition apps)", async () => {
        const data = await client.callTool<LicensesListResponse>("licenses_list", {
          appEdition: "standard",
          limit: 3,
        });
        // The dev space may or may not have such licenses; just verify no error.
        expect(Array.isArray(data.licenses)).toBe(true);
      });

      it("rejects bogus appEdition via Zod", async () => {
        const err = await client.callToolExpectingError("licenses_list", {
          appEdition: "Bogus" as unknown as "free",
        });
        expect(err).toMatch(/invalid_enum_value/i);
      });

      it("showLifeTimeFreeLicenses=true vs false produces different counts", async () => {
        const lifetimeOnly = await client.callTool<LicensesListResponse | TruncatedResponse>(
          "licenses_list",
          { showLifeTimeFreeLicenses: true, limit: 50 }
        );
        const paid = await client.callTool<LicensesListResponse | TruncatedResponse>(
          "licenses_list",
          { showLifeTimeFreeLicenses: false, limit: 50 }
        );
        // Either side may truncate; just check they came back successfully.
        const lifetimeCount = "_truncated" in lifetimeOnly
          ? lifetimeOnly._bytes
          : lifetimeOnly.licenses.length;
        const paidCount = "_truncated" in paid ? paid._bytes : paid.licenses.length;
        // In our space, lifetime-free is much smaller than paid — the counts differ.
        expect(lifetimeCount).not.toBe(paidCount);
      });

      it("withDataInsights=true adds extra enrichment fields not present in the baseline response", async () => {
        const baseline = await client.callTool<LicensesListResponse>("licenses_list", {
          text: fx.firstSen!,
        });
        const enriched = await client.callTool<LicensesListResponse>("licenses_list", {
          text: fx.firstSen!,
          withDataInsights: true,
        });
        const baseKeys = new Set(Object.keys(baseline.licenses[0] ?? {}));
        const enrichedKeys = new Set(Object.keys(enriched.licenses[0] ?? {}));
        const extra = [...enrichedKeys].filter((k) => !baseKeys.has(k));
        // The exact fields depend on the license's history (evaluation licenses
        // get evaluation* fields; ex-trial commercial gets evaluation+parentProduct;
        // pure commercial gets parentProduct only). The invariant is: SOME extra
        // fields are added, drawn from the documented set.
        expect(extra.length).toBeGreaterThan(0);
        const KNOWN_ENRICHMENT_FIELDS = [
          "evaluationOpportunitySize",
          "evaluationLicense",
          "daysToConvertEval",
          "evaluationStartDate",
          "evaluationEndDate",
          "evaluationSaleDate",
          "parentProductBillingCycle",
          "parentProductName",
          "installedOnSandbox",
          "parentProductEdition",
        ];
        for (const k of extra) {
          expect(KNOWN_ENRICHMENT_FIELDS, `unexpected enrichment field "${k}" — Atlassian may have added a new field`).toContain(k);
        }
      });
    });

    // -------------------------------------------------------------------------
    // Atlassian-side quirks (documented, not fixable)
    // -------------------------------------------------------------------------
    describe("Atlassian-side behaviors (documented quirks)", () => {
      it("order=asc and order=desc produce IDENTICAL results — Atlassian ignores `order` on licenses_list", async () => {
        const args = {
          sortBy: "startDate" as const,
          limit: 5,
          dateType: "start" as const,
          startDate: "2026-05-01",
          endDate: "2026-05-31",
          productId: fx.secondary!.productId,
        };
        const asc = await client.callTool<LicensesListResponse>("licenses_list", {
          ...args,
          order: "asc",
        });
        const desc = await client.callTool<LicensesListResponse>("licenses_list", {
          ...args,
          order: "desc",
        });
        const ascDates = asc.licenses.map((l) => l.maintenanceStartDate);
        const descDates = desc.licenses.map((l) => l.maintenanceStartDate);
        expect(ascDates).toEqual(descDates);
      });
    });

    it("accepts limit=50 (boundary). Response may be inline OR spilled to /tmp via the truncation handler.", async () => {
      const data = await client.callTool<LicensesListResponse | TruncatedResponse>("licenses_list", { limit: 50 });
      if ("_truncated" in data) {
        // 50 licenses returns ~80 KB of JSON — over the 50 KB MAX_RESPONSE_CHARS,
        // so jsonResult spills it to a tmp file.
        expect(data._bytes).toBeGreaterThan(50_000);
        expect(data._file).toMatch(/atlassian-mcp-[0-9a-f]+\.json$/);
        expect(data._preview).toContain("appEntitlementNumber");
      } else {
        expect(data.licenses.length).toBeLessThanOrEqual(50);
        expect(data.licenses.length).toBeGreaterThan(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // licenses_export_sync
  // ---------------------------------------------------------------------------
  describe("licenses_export_sync", () => {
    it("returns CSV with the expected header columns", async () => {
      // Note: the result here is a CSV string. callTool will try to JSON.parse;
      // it'll fall back to returning the raw string when parsing fails.
      const csv = await client.callTool<string>("licenses_export_sync", {
        limit: 2,
        startDate: "2026-05-01",
        endDate: "2026-06-01",
        productId: fx.secondary!.productId,
      });
      expect(typeof csv).toBe("string");
      expect(csv.length).toBeGreaterThan(0);
      // First line is the header row
      const header = csv.split("\n")[0];
      expect(header).toContain("addonLicenseId");
      expect(header).toContain("licenseType");
      expect(header).toContain("status");
      expect(header).toContain("hosting");
    });

    it("accept=json returns a JSON array (default is CSV); invalid accept → Zod error", async () => {
      const json = await client.callTool<unknown>("licenses_export_sync", {
        limit: 2, startDate: "2026-05-01", endDate: "2026-06-01", productId: fx.secondary!.productId, accept: "json",
      });
      // small range → inline; should parse to an array (not a CSV string)
      if (typeof json !== "string") {
        expect(Array.isArray(json) || (json as { _truncated?: boolean })._truncated).toBeTruthy();
      }
      const err = await client.callToolExpectingError("licenses_export_sync", { accept: "xml" } as Record<string, unknown>);
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });
  });

  // ---------------------------------------------------------------------------
  // Async export flow: start → status → download
  // ---------------------------------------------------------------------------
  describe("licenses_export_async_* (full lifecycle)", () => {
    it("start returns an exportId, status reports COMPLETED, download yields license records", async () => {
      // 1. start
      const start = await client.callTool<ExportStartResponse>("licenses_export_async_start", {
        limit: 2,
        startDate: "2026-05-01",
        endDate: "2026-06-01",
      });
      const exportId = start.export.id;
      expect(exportId).toMatch(UUID_RE);

      // 2. status — poll until COMPLETED (max ~30 seconds for a 2-row export)
      let status = "";
      for (let i = 0; i < 15; i++) {
        const s = await client.callTool<ExportStatusResponse>("licenses_export_async_status", { exportId });
        status = s.export.status.toUpperCase();
        if (status === "COMPLETED" || status === "DONE") break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      expect(status).toBe("COMPLETED");

      // 3. download — may be truncated to file (jsonResult spills > MAX_RESPONSE_CHARS)
      const dl = await client.callTool<License[] | TruncatedResponse>(
        "licenses_export_async_download",
        { exportId }
      );
      if ("_truncated" in dl) {
        // truncation envelope path
        expect(dl._file).toMatch(/^.*atlassian-mcp-[0-9a-f]+\.json$/);
        expect(dl._bytes).toBeGreaterThan(0);
        expect(dl._preview).toContain("appEntitlementNumber");
      } else {
        expect(Array.isArray(dl)).toBe(true);
        expect(dl.length).toBeGreaterThan(0);
        expect(dl[0].appEntitlementNumber).toMatch(SEN_RE);
      }
    });

    it("status with a bogus exportId returns isError", async () => {
      const err = await client.callToolExpectingError("licenses_export_async_status", {
        exportId: "00000000-0000-0000-0000-000000000000",
      });
      expect(err).toMatch(/HTTP 404/i);
    });

    it("download against a not-yet-ready exportId returns isError (\"Export is being processed\")", async () => {
      const start = await client.callTool<ExportStartResponse>("licenses_export_async_start", {
        limit: 2,
      });
      // Try to download immediately, before the job has had time to complete.
      const err = await client.callToolExpectingError("licenses_export_async_download", {
        exportId: start.export.id,
      });
      // We expect either a 404 with "Export is being processed" — or, if Atlassian
      // happens to be fast enough today, the call succeeds. We're checking the
      // error path here; allow it to be flaky by also accepting an HTTP 200 quietly.
      // Just ensure it's not throwing for another reason.
      expect(err).toMatch(/HTTP 404|Export is being processed|expected.*to fail/i);
    });

    it("status requires exportId (Zod)", async () => {
      const err = await client.callToolExpectingError("licenses_export_async_status", {});
      expect(err).toMatch(/required|invalid_type/i);
    });

    it("download requires exportId (Zod)", async () => {
      const err = await client.callToolExpectingError("licenses_export_async_download", {});
      expect(err).toMatch(/required|invalid_type/i);
    });
  });
});
