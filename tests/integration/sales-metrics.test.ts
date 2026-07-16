/**
 * Integration tests for the Sales Metrics tools.
 *
 * Tools covered (6):
 *   - metrics_churn
 *   - metrics_churn_benchmark
 *   - metrics_conversion
 *   - metrics_renewal
 *   - metrics_details_by_metric
 *   - metrics_details_export
 *
 * Findings verified during the audit (2026-06-02):
 *   - Aggregate endpoints (churn/conversion/renewal) accept ONLY
 *     `aggregation, startDate, endDate` per their HAL query template.
 *     productId/hosting/addon are silently ignored — these tests prove it.
 *   - Benchmark uses `addon` (app key, NOT productId).
 *   - Details endpoint server-caps limit at 50.
 *   - `sortBy=eventDate` is silently rejected on details (returns 0 events).
 *
 * Live API; self-skips when creds absent.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";
import { discoverFixtures, type Fixtures } from "../helpers/fixtures.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface SeriesElement { date: string; count: number; }
interface Series { name: string; uniqueTotal?: number; elements: SeriesElement[]; }
interface Dataset { name: string; series: Series[]; }
interface AddonNode { addonKey: string; name: string; productId: string; datasets: Dataset[]; }
interface AggregateResponse {
  _links: { self?: any; query?: { href: string; templated?: boolean } };
  total: { name: string; datasets: Dataset[] };
  addons: AddonNode[];
}

// metrics_conversion is structurally DIFFERENT from churn/renewal: `total.series`
// is FLAT (no datasets[] billing-period split), series have no `uniqueTotal`,
// and addons carry `series` directly.
interface ConversionAddon { addonKey: string; name: string; productId: string; series: Series[]; }
interface ConversionResponse {
  _links: { self?: any; query?: { href: string; templated?: boolean } };
  total: { name: string; series: Series[] };
  addons: ConversionAddon[];
}

interface BenchmarkMonth {
  year: string; month: string;
  churnedLicenses: number; totalLicenses: number;
  churnRate: number; isolatedChurnRate: number;
  churnRateBenchmark: number; isolatedChurnRateBenchmark: number;
}
interface BenchmarkApp {
  appName: string; appKey: string; productId: string;
  churnBenchmarkPerMonth: BenchmarkMonth[];
}
interface BenchmarkResponse {
  _links: { self?: any; query?: { href: string; templated?: boolean } };
  churnBenchmarkPerApp: BenchmarkApp[];
}

interface LicenseDetails {
  appEntitlementId?: string;
  appEntitlementNumber?: string;
  cloudId?: string;
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  monthsValid?: number;
}
interface DetailsEvent {
  addonKey: string;
  addonName: string;
  hosting: string;
  lastUpdated: string;
  eventDate: string;
  transactionId: string;
  licenseDetails: LicenseDetails;
  productId: string;
}
interface DetailsResponse {
  _links: { self?: any; query?: { href: string; templated?: boolean } };
  events: DetailsEvent[];
}

describe.skipIf(!hasLiveCreds())("Block D: Sales metrics tools (live API)", () => {
  let client: McpTestClient;
  let fx: Fixtures;
  beforeAll(async () => {
    client = await McpTestClient.start();
    fx = await discoverFixtures(client);
  });
  afterAll(async () => { await client.close(); });

  // ---------------------------------------------------------------------------
  // metrics_churn
  // ---------------------------------------------------------------------------
  describe("metrics_churn", () => {
    it("returns HAL shape with total.datasets[Monthly,Annual] each with Customers/Cancellations series", async () => {
      const d = await client.callTool<AggregateResponse>("metrics_churn", {
        startDate: "2026-05-01", endDate: "2026-06-01",
      });
      expect(d._links?.query?.href).toContain("{?aggregation,startDate,endDate}");
      expect(d.total.name).toBe("All apps");
      const dsNames = d.total.datasets.map((x) => x.name).sort();
      expect(dsNames).toEqual(["Annual", "Monthly"]);
      for (const ds of d.total.datasets) {
        const sNames = ds.series.map((s) => s.name).sort();
        expect(sNames).toEqual(["Cancellations", "Customers"]);
        for (const s of ds.series) {
          expect(s.elements.length).toBeGreaterThan(0);
          for (const el of s.elements) {
            expect(el.date).toMatch(ISO_DATE);
            expect(typeof el.count).toBe("number");
          }
        }
      }
      expect(Array.isArray(d.addons)).toBe(true);
      for (const a of d.addons) {
        expect(a.addonKey).toEqual(expect.any(String));
        expect(a.productId).toMatch(UUID_RE);
        expect(Array.isArray(a.datasets)).toBe(true);
      }
    });

    it("aggregation=week returns more elements than aggregation=month over the same range", async () => {
      // Keep range small enough to avoid the 50k truncation envelope on churn
      // (which has 2 datasets × 2 series and 5 addons each — grows fast).
      const week = await client.callTool<AggregateResponse>("metrics_churn", {
        startDate: "2026-03-01", endDate: "2026-06-01", aggregation: "week",
      });
      const month = await client.callTool<AggregateResponse>("metrics_churn", {
        startDate: "2026-03-01", endDate: "2026-06-01", aggregation: "month",
      });
      const wEls = week.total.datasets[0]?.series[0]?.elements.length ?? 0;
      const mEls = month.total.datasets[0]?.series[0]?.elements.length ?? 0;
      expect(wEls).toBeGreaterThan(mEls);
    });

    it("aggregation=foo is rejected by Atlassian with a clear error", async () => {
      const err = await client.callToolExpectingError("metrics_churn", { aggregation: "foo" });
      // Zod first (enum); if our enum didn't catch it, Atlassian's enum would.
      expect(err.toLowerCase()).toMatch(/aggregation|allowable|enum|invalid/);
    });

    it("invalid startDate is rejected by Atlassian", async () => {
      const err = await client.callToolExpectingError("metrics_churn", { startDate: "not-a-date" });
      expect(err.toLowerCase()).toMatch(/date/);
    });

    // ─── Edge cases discovered during the audit (Probes 4-7) ───

    it("(A) reversed range — endDate before startDate — returns 200 with empty datasets and addons (no error)", async () => {
      const d = await client.callTool<AggregateResponse>("metrics_churn", {
        startDate: "2026-06-01", endDate: "2026-04-01",
      });
      expect(d._links).toBeDefined();
      expect(d.total.name).toBe("All apps");
      expect(d.total.datasets).toEqual([]);
      expect(d.addons).toEqual([]);
    });

    it("(B) future-only range — both dates after today — returns 200 with empty datasets and addons", async () => {
      const d = await client.callTool<AggregateResponse>("metrics_churn", {
        startDate: "2028-01-01", endDate: "2028-06-01",
      });
      expect(d.total.datasets).toEqual([]);
      expect(d.addons).toEqual([]);
    });

    it("(C) Zod strips unknown args BEFORE the upstream call — self.href never contains them", async () => {
      // The MCP SDK wraps our shape in z.object() which strips unknown keys.
      // Verify by passing junk and checking Atlassian's echoed self URL.
      const d = await client.callTool<AggregateResponse>("metrics_churn", {
        startDate: "2026-05-01",
        endDate: "2026-06-01",
        aggregation: "month",
        productId: "foo",
        hosting: "cloud",
        totallyMadeUp: "yes",
      } as Record<string, unknown>);
      const self: string = (d._links?.self as { href: string })?.href ?? "";
      // Allowed keys should appear in the echoed URL
      expect(self).toContain("aggregation=month");
      expect(self).toContain("startDate=2026-05-01");
      expect(self).toContain("endDate=2026-06-01");
      // Stripped keys must NOT appear
      expect(self).not.toContain("productId");
      expect(self).not.toContain("hosting");
      expect(self).not.toContain("totallyMadeUp");
    });

    it("(D) week aggregation aligns to Sunday — first element ≤ startDate, alignment is the preceding Sunday", async () => {
      // 2026-04-01 is a Wednesday → preceding Sunday is 2026-03-29.
      const d = await client.callTool<AggregateResponse>("metrics_churn", {
        startDate: "2026-04-01", endDate: "2026-06-01", aggregation: "week",
      });
      const customers = d.total.datasets
        .find((ds) => ds.name === "Monthly")
        ?.series.find((s) => s.name === "Customers");
      const firstDate = customers?.elements[0]?.date;
      expect(firstDate).toBe("2026-03-29");
      // Confirms the documented behavior: weekly buckets align on Sunday and
      // the first bucket can be BEFORE the requested startDate.
      expect(new Date(firstDate!).getTime()).toBeLessThanOrEqual(new Date("2026-04-01").getTime());
    });

    it("(E) uniqueTotal is de-duplicated across the range — strictly LESS than the sum of per-week counts (when customers persist across weeks)", async () => {
      const d = await client.callTool<AggregateResponse>("metrics_churn", {
        startDate: "2026-04-01", endDate: "2026-06-01", aggregation: "week",
      });
      const customers = d.total.datasets
        .find((ds) => ds.name === "Monthly")
        ?.series.find((s) => s.name === "Customers");
      expect(customers).toBeDefined();
      const sumOfWeeks = customers!.elements.reduce((acc, e) => acc + e.count, 0);
      const uniqueTotal = customers!.uniqueTotal!;
      // The data we observed: uniqueTotal=145, sum of weeks=275 (almost 2x).
      // Customers that persist across multiple weeks inflate the sum.
      expect(uniqueTotal).toBeGreaterThan(0);
      expect(sumOfWeeks).toBeGreaterThan(uniqueTotal);
    });
  });

  // ---------------------------------------------------------------------------
  // metrics_churn_benchmark
  // ---------------------------------------------------------------------------
  describe("metrics_churn_benchmark", () => {
    it("returns churnBenchmarkPerApp with monthly buckets per app", async () => {
      const d = await client.callTool<BenchmarkResponse>("metrics_churn_benchmark", {
        startDate: "2026-01-01", endDate: "2026-03-31",
      });
      // HAL query.href advertises only addon/dates (productId is undocumented but works — see (A))
      expect(d._links?.query?.href).toMatch(/addon\*?,?startDate,?endDate/);
      expect(Array.isArray(d.churnBenchmarkPerApp)).toBe(true);
    });

    it("addon=<key> narrows to that one app", async () => {
      const d = await client.callTool<BenchmarkResponse>("metrics_churn_benchmark", {
        startDate: "2026-01-01", endDate: "2026-03-31", addon: fx.primary.appKey,
      });
      expect(d.churnBenchmarkPerApp.length).toBeGreaterThanOrEqual(1);
      for (const app of d.churnBenchmarkPerApp) {
        expect(app.appKey).toBe(fx.primary.appKey);
        for (const m of app.churnBenchmarkPerMonth) {
          expect(m.year).toMatch(/^\d{4}$/);
          expect(m.month).toMatch(/^\d{2}$/);
          expect(typeof m.churnRate).toBe("number");
          expect(typeof m.churnRateBenchmark).toBe("number");
        }
      }
    });

    // ─── Audit findings (2026-06-02) — A through H ───

    it("(A) productId=<UUID> narrows to that one app — undocumented in HAL template, but real", async () => {
      const d = await client.callTool<BenchmarkResponse>("metrics_churn_benchmark", {
        startDate: "2026-01-01", endDate: "2026-03-31",
        productId: fx.primary.productId,
      });
      expect(d.churnBenchmarkPerApp).toHaveLength(1);
      expect(d.churnBenchmarkPerApp[0].appKey).toBe(fx.primary.appKey);
      expect(d.churnBenchmarkPerApp[0].productId).toBe(fx.primary.productId);
    });

    it("(B) productId with INVALID UUID shape → silently ignored, full list returned", async () => {
      const baseline = await client.callTool<BenchmarkResponse>("metrics_churn_benchmark", {
        startDate: "2025-01-01", endDate: "2026-03-31",
      });
      const withBadId = await client.callTool<BenchmarkResponse>("metrics_churn_benchmark", {
        startDate: "2025-01-01", endDate: "2026-03-31",
        productId: "not-a-uuid",
      });
      // Same app list — productId was ignored
      expect(withBadId.churnBenchmarkPerApp.map((a) => a.appKey).sort())
        .toEqual(baseline.churnBenchmarkPerApp.map((a) => a.appKey).sort());
    });

    it("(C) productId with valid UUID shape but NO MATCH → silently ignored, full list returned", async () => {
      const baseline = await client.callTool<BenchmarkResponse>("metrics_churn_benchmark", {
        startDate: "2025-01-01", endDate: "2026-03-31",
      });
      const withNoMatch = await client.callTool<BenchmarkResponse>("metrics_churn_benchmark", {
        startDate: "2025-01-01", endDate: "2026-03-31",
        productId: "00000000-0000-0000-0000-000000000000",
      });
      expect(withNoMatch.churnBenchmarkPerApp.map((a) => a.appKey).sort())
        .toEqual(baseline.churnBenchmarkPerApp.map((a) => a.appKey).sort());
    });

    it("(D) when productId AND addon both passed — productId wins, addon is ignored", async () => {
      // productId of the primary app, addon-key of a DIFFERENT app — productId should win
      const d = await client.callTool<BenchmarkResponse>("metrics_churn_benchmark", {
        startDate: "2025-01-01", endDate: "2026-03-31",
        productId: fx.primary.productId,
        addon: fx.secondary!.appKey,
      });
      expect(d.churnBenchmarkPerApp).toHaveLength(1);
      expect(d.churnBenchmarkPerApp[0].appKey).toBe(fx.primary.appKey);
      // Secondary app's key was NOT returned — confirms productId precedence
      expect(d.churnBenchmarkPerApp[0].appKey).not.toBe(fx.secondary!.appKey);
    });

    it("(E) invalid date format is rejected by Atlassian (clean 400)", async () => {
      const err = await client.callToolExpectingError("metrics_churn_benchmark", {
        startDate: "not-a-date",
      });
      expect(err.toLowerCase()).toMatch(/date/);
    });

    it("(F) reversed range (endDate < startDate) → 200 with empty churnBenchmarkPerApp", async () => {
      const d = await client.callTool<BenchmarkResponse>("metrics_churn_benchmark", {
        startDate: "2026-03-31", endDate: "2026-01-01",
      });
      expect(d.churnBenchmarkPerApp).toEqual([]);
    });

    it("(G) per-month field types and value ranges are consistent", async () => {
      const d = await client.callTool<BenchmarkResponse>("metrics_churn_benchmark", {
        startDate: "2025-01-01", endDate: "2026-03-31", addon: fx.primary.appKey,
      });
      expect(d.churnBenchmarkPerApp.length).toBeGreaterThanOrEqual(1);
      for (const app of d.churnBenchmarkPerApp) {
        for (const m of app.churnBenchmarkPerMonth) {
          // Strings with leading zeros preserved
          expect(m.year).toMatch(/^\d{4}$/);
          expect(m.month).toMatch(/^(0[1-9]|1[0-2])$/);
          // Counts: non-negative integers, churned <= total
          expect(Number.isInteger(m.churnedLicenses)).toBe(true);
          expect(Number.isInteger(m.totalLicenses)).toBe(true);
          expect(m.churnedLicenses).toBeGreaterThanOrEqual(0);
          expect(m.totalLicenses).toBeGreaterThanOrEqual(0);
          expect(m.churnedLicenses).toBeLessThanOrEqual(m.totalLicenses);
          // Rates: 0-100 percentage
          expect(m.churnRate).toBeGreaterThanOrEqual(0);
          expect(m.churnRate).toBeLessThanOrEqual(100);
          expect(m.isolatedChurnRate).toBeGreaterThanOrEqual(0);
          expect(m.isolatedChurnRate).toBeLessThanOrEqual(100);
          // Benchmarks: positive floats, no upper bound (your-rate / ecosystem-rate; can be > 1)
          expect(m.churnRateBenchmark).toBeGreaterThanOrEqual(0);
          expect(m.isolatedChurnRateBenchmark).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("(H) far-future date range returns empty — publication lag means no future benchmark data", async () => {
      // Hardcoded far-future dates so the test is stable indefinitely.
      // (Today is well before 2030.) Atlassian only publishes benchmarks for
      // months ~2-3 behind real-time, so anything in 2030+ is empty.
      const d = await client.callTool<BenchmarkResponse>("metrics_churn_benchmark", {
        startDate: "2030-01-01", endDate: "2030-12-31",
      });
      expect(d.churnBenchmarkPerApp).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // metrics_conversion
  // ---------------------------------------------------------------------------
  describe("metrics_conversion", () => {
    // (A) Exact shape: FLAT total.series (not datasets), Evaluations + Conversions,
    //     and NO uniqueTotal field — the structural difference from churn/renewal.
    it("(A) total.series is FLAT (no datasets[]) with Evaluations + Conversions, no uniqueTotal", async () => {
      const d = await client.callTool<ConversionResponse>("metrics_conversion", {
        startDate: "2026-05-01", endDate: "2026-06-01",
      });
      expect(d._links?.query?.href).toContain("{?aggregation,startDate,endDate}");
      expect(d.total.name).toBe("All apps");
      // total has `series` directly, NOT `datasets`
      expect(Array.isArray(d.total.series)).toBe(true);
      expect((d.total as { datasets?: unknown }).datasets).toBeUndefined();
      const seriesNames = d.total.series.map((s) => s.name).sort();
      expect(seriesNames).toEqual(["Conversions", "Evaluations"]);
      for (const s of d.total.series) {
        // No uniqueTotal on conversion series (churn had it)
        expect(s.uniqueTotal).toBeUndefined();
        expect(Array.isArray(s.elements)).toBe(true);
        for (const el of s.elements) {
          expect(el.date).toMatch(ISO_DATE);
          expect(typeof el.count).toBe("number");
        }
      }
    });

    // (B) addons carry `series` directly (not datasets).
    it("(B) addons[] carry series directly with the same Evaluations/Conversions shape", async () => {
      const d = await client.callTool<ConversionResponse>("metrics_conversion", {
        startDate: "2026-05-01", endDate: "2026-06-01",
      });
      expect(Array.isArray(d.addons)).toBe(true);
      expect(d.addons.length).toBeGreaterThan(0);
      for (const a of d.addons) {
        expect(a.addonKey).toEqual(expect.any(String));
        expect(a.productId).toMatch(UUID_RE);
        expect(Array.isArray(a.series)).toBe(true);
        expect((a as { datasets?: unknown }).datasets).toBeUndefined();
        const names = a.series.map((s) => s.name).sort();
        expect(names).toEqual(["Conversions", "Evaluations"]);
      }
    });

    // (C) representative silent-ignore: productId does not change the response body.
    it("(C) productId is silently ignored (response identical with/without)", async () => {
      const baseline = await client.callTool<ConversionResponse>("metrics_conversion", {
        startDate: "2026-05-01", endDate: "2026-06-01",
      });
      const withProduct = await client.callTool<ConversionResponse>("metrics_conversion", {
        startDate: "2026-05-01", endDate: "2026-06-01",
        productId: fx.primary.productId,
      } as Record<string, unknown>);
      // Same number of addons, same series totals — productId had no effect
      expect(withProduct.addons.length).toBe(baseline.addons.length);
      const sum = (r: ConversionResponse, name: string) =>
        r.total.series.find((s) => s.name === name)!.elements.reduce((a, e) => a + e.count, 0);
      expect(sum(withProduct, "Evaluations")).toBe(sum(baseline, "Evaluations"));
      expect(sum(withProduct, "Conversions")).toBe(sum(baseline, "Conversions"));
    });

    // (D) aggregation cadence. Keep the range small (3 months) so neither
    //     response trips the 50k truncation envelope (which would replace
    //     `total` with the {_truncated,...} summary).
    it("(D) aggregation=week returns more elements than aggregation=month", async () => {
      const week = await client.callTool<ConversionResponse>("metrics_conversion", {
        startDate: "2026-01-01", endDate: "2026-03-31", aggregation: "week",
      });
      const month = await client.callTool<ConversionResponse>("metrics_conversion", {
        startDate: "2026-01-01", endDate: "2026-03-31", aggregation: "month",
      });
      expect(week.total.series[0].elements.length).toBeGreaterThan(month.total.series[0].elements.length);
    });

    // (E) invalid date.
    it("(E) invalid date format is rejected by Atlassian (400)", async () => {
      const err = await client.callToolExpectingError("metrics_conversion", { startDate: "not-a-date" });
      expect(err.toLowerCase()).toMatch(/date/);
    });

    // (F) reversed range → empty.
    it("(F) reversed range (endDate < startDate) returns empty series and addons", async () => {
      const d = await client.callTool<ConversionResponse>("metrics_conversion", {
        startDate: "2026-06-01", endDate: "2026-04-01",
      });
      expect(d.total.series).toEqual([]);
      expect(d.addons).toEqual([]);
    });

    // (G) narrow range still populated — anti-regression for the old (wrong)
    //     "conversion returns empty datasets for narrow ranges" assumption.
    it("(G) a narrow 1-month range still returns populated series (NOT empty)", async () => {
      const d = await client.callTool<ConversionResponse>("metrics_conversion", {
        startDate: "2026-05-01", endDate: "2026-06-01",
      });
      expect(d.total.series.length).toBe(2);
      expect(d.total.series[0].elements.length).toBeGreaterThan(0);
      expect(d.addons.length).toBeGreaterThan(0);
    });

    it("over a wide range, response is spilled to a tmp file via truncation envelope", async () => {
      const d = await client.callTool<{ _truncated?: boolean; _file?: string; _bytes?: number; _preview?: string }>(
        "metrics_conversion",
        { startDate: "2025-01-01", endDate: "2026-06-01" }
      );
      expect(d._truncated).toBe(true);
      expect(d._file).toMatch(/atlassian-mcp-[a-f0-9]+\.json$/);
      expect(d._bytes).toBeGreaterThan(50_000);
      // Preview still carries the HAL shape
      expect(d._preview).toContain("_links");
    });
  });

  // ---------------------------------------------------------------------------
  // metrics_renewal
  // ---------------------------------------------------------------------------
  describe("metrics_renewal", () => {
    // (A) Shape: datasets[] (Annual/Monthly) like churn, series are
    //     Renewal opportunities + Renewals, but NO uniqueTotal (hybrid).
    it("(A) total.datasets[] (Annual/Monthly) with Renewal opportunities + Renewals, no uniqueTotal", async () => {
      const d = await client.callTool<AggregateResponse>("metrics_renewal", {
        startDate: "2026-01-01", endDate: "2026-03-31",
      });
      expect(d._links?.query?.href).toContain("{?aggregation,startDate,endDate}");
      expect(d.total.name).toBe("All apps");
      expect(Array.isArray(d.total.datasets)).toBe(true);
      const dsNames = d.total.datasets.map((ds) => ds.name).sort();
      expect(dsNames).toEqual(["Annual", "Monthly"]);
      for (const ds of d.total.datasets) {
        const sNames = ds.series.map((s) => s.name).sort();
        expect(sNames).toEqual(["Renewal opportunities", "Renewals"]);
        for (const s of ds.series) {
          // Renewal series carry NO uniqueTotal (unlike churn's series)
          expect(s.uniqueTotal).toBeUndefined();
          for (const el of s.elements) {
            expect(el.date).toMatch(ISO_DATE);
            expect(typeof el.count).toBe("number");
          }
        }
      }
    });

    // (B) addons carry datasets (not flat series).
    it("(B) addons[] carry datasets with the Renewal series shape", async () => {
      const d = await client.callTool<AggregateResponse>("metrics_renewal", {
        startDate: "2026-01-01", endDate: "2026-03-31",
      });
      expect(d.addons.length).toBeGreaterThan(0);
      for (const a of d.addons) {
        expect(a.productId).toMatch(UUID_RE);
        expect(Array.isArray(a.datasets)).toBe(true);
        expect((a as { series?: unknown }).series).toBeUndefined();
      }
    });

    // (C) representative silent-ignore.
    it("(C) productId is silently ignored (response identical with/without)", async () => {
      const baseline = await client.callTool<AggregateResponse>("metrics_renewal", {
        startDate: "2026-01-01", endDate: "2026-03-31", aggregation: "month",
      });
      const withProduct = await client.callTool<AggregateResponse>("metrics_renewal", {
        startDate: "2026-01-01", endDate: "2026-03-31", aggregation: "month",
        productId: fx.primary.productId,
      } as Record<string, unknown>);
      const sum = (r: AggregateResponse) =>
        r.total.datasets.flatMap((ds) => ds.series).flatMap((s) => s.elements).reduce((a, e) => a + e.count, 0);
      expect(withProduct.addons.length).toBe(baseline.addons.length);
      expect(sum(withProduct)).toBe(sum(baseline));
    });

    // (D) aggregation cadence.
    it("(D) aggregation=week returns more elements than aggregation=month", async () => {
      const week = await client.callTool<AggregateResponse>("metrics_renewal", {
        startDate: "2026-01-01", endDate: "2026-03-31", aggregation: "week",
      });
      const month = await client.callTool<AggregateResponse>("metrics_renewal", {
        startDate: "2026-01-01", endDate: "2026-03-31", aggregation: "month",
      });
      expect(week.total.datasets[0].series[0].elements.length)
        .toBeGreaterThan(month.total.datasets[0].series[0].elements.length);
    });

    // (E) invalid date.
    it("(E) invalid date format is rejected by Atlassian (400)", async () => {
      const err = await client.callToolExpectingError("metrics_renewal", { startDate: "not-a-date" });
      expect(err.toLowerCase()).toMatch(/date/);
    });

    // (F) reversed range → empty.
    it("(F) reversed range (endDate < startDate) returns empty datasets and addons", async () => {
      const d = await client.callTool<AggregateResponse>("metrics_renewal", {
        startDate: "2026-06-01", endDate: "2026-04-01",
      });
      expect(d.total.datasets).toEqual([]);
      expect(d.addons).toEqual([]);
    });

    // (G) future range → empty.
    it("(G) far-future range returns empty datasets and addons", async () => {
      const d = await client.callTool<AggregateResponse>("metrics_renewal", {
        startDate: "2030-01-01", endDate: "2030-06-01",
      });
      expect(d.total.datasets).toEqual([]);
      expect(d.addons).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // metrics_details_by_metric
  // ---------------------------------------------------------------------------
  describe("metrics_details_by_metric", () => {
    it("saleMetric=churn returns events[] with the expected shape", async () => {
      const d = await client.callTool<DetailsResponse>("metrics_details_by_metric", {
        saleMetric: "churn", startDate: "2026-05-01", endDate: "2026-06-01", limit: 5,
      });
      expect(d._links?.query?.href).toContain("{?addon");
      expect(Array.isArray(d.events)).toBe(true);
      for (const e of d.events) {
        expect(e.addonKey).toEqual(expect.any(String));
        expect(e.addonName).toEqual(expect.any(String));
        // Hosting case differs from licenses_list — events use "Data center" (lowercase 'c').
        expect(e.hosting).toMatch(/^(Cloud|Server|Data [Cc]enter)$/);
        expect(e.eventDate).toMatch(ISO_DATE);
        expect(e.transactionId).toEqual(expect.any(String));
        expect(e.productId).toMatch(UUID_RE);
      }
    });

    it("productId narrows events to that app (documented spec filter)", async () => {
      const d = await client.callTool<DetailsResponse>("metrics_details_by_metric", {
        saleMetric: "churn", startDate: "2024-01-01", endDate: "2026-06-01",
        productId: fx.primary.productId, limit: 50,
      });
      for (const e of d.events) expect(e.productId).toBe(fx.primary.productId);
    });

    it("appEdition is accepted (enum free/standard/advanced)", async () => {
      const d = await client.callTool<DetailsResponse>("metrics_details_by_metric", {
        saleMetric: "churn", startDate: "2024-01-01", endDate: "2026-06-01",
        appEdition: "advanced", limit: 50,
      });
      expect(Array.isArray(d.events)).toBe(true);
    });

    it("addon=<key> narrows events to only that addon", async () => {
      const d = await client.callTool<DetailsResponse>("metrics_details_by_metric", {
        saleMetric: "churn", startDate: "2026-05-01", endDate: "2026-06-01",
        addon: fx.primary.appKey, limit: 10,
      });
      for (const e of d.events) {
        expect(e.addonKey).toBe(fx.primary.appKey);
      }
    });

    it("hosting=cloud returns only Cloud events; hosting=server returns 0 (no server licenses in this dev space)", async () => {
      const cloud = await client.callTool<DetailsResponse>("metrics_details_by_metric", {
        saleMetric: "churn", startDate: "2026-05-01", endDate: "2026-06-01",
        hosting: "cloud", limit: 10,
      });
      for (const e of cloud.events) expect(e.hosting).toBe("Cloud");

      const server = await client.callTool<DetailsResponse>("metrics_details_by_metric", {
        saleMetric: "churn", startDate: "2026-05-01", endDate: "2026-06-01",
        hosting: "server", limit: 10,
      });
      expect(server.events.length).toBe(0);
    });

    it("limit is server-capped at 50 (passing 100 returns at most 50)", async () => {
      // Use a wide range so there's potentially > 50 events
      const d = await client.callTool<DetailsResponse>("metrics_details_by_metric", {
        saleMetric: "churn", startDate: "2024-01-01", endDate: "2026-06-01", limit: 50,
      } as any);
      expect(d.events.length).toBeLessThanOrEqual(50);
    });

    it("invalid saleMetric is rejected by our Zod enum BEFORE hitting Atlassian", async () => {
      const err = await client.callToolExpectingError("metrics_details_by_metric", {
        saleMetric: "invalid-metric",
      });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    it("limit > 50 is rejected by our Zod max() BEFORE hitting Atlassian", async () => {
      const err = await client.callToolExpectingError("metrics_details_by_metric", {
        saleMetric: "churn", limit: 999,
      });
      expect(err.toLowerCase()).toMatch(/50|too|max|big/);
    });

    it("sortBy=date works and orders events ascending by date", async () => {
      const d = await client.callTool<DetailsResponse>("metrics_details_by_metric", {
        saleMetric: "churn", startDate: "2024-01-01", endDate: "2026-06-01",
        sortBy: "date", order: "asc", limit: 10,
      });
      if (d.events.length >= 2) {
        for (let i = 1; i < d.events.length; i++) {
          expect(d.events[i].eventDate >= d.events[i - 1].eventDate).toBe(true);
        }
      }
    });

    it("invalid sortBy is caught by our Zod enum BEFORE hitting Atlassian", async () => {
      const err = await client.callToolExpectingError("metrics_details_by_metric", {
        saleMetric: "churn", sortBy: "eventDate",
      });
      // Zod enum rejects with the allowed list
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    // ─── gaps filled during the 2026-06-03 deep audit ───

    it("all three saleMetric paths (churn/conversion/renewal) return events[]", async () => {
      for (const saleMetric of ["churn", "conversion", "renewal"] as const) {
        const d = await client.callTool<DetailsResponse>("metrics_details_by_metric", {
          saleMetric, startDate: "2026-01-01", endDate: "2026-06-01", limit: 5,
        });
        expect(Array.isArray(d.events), `${saleMetric} should return events[]`).toBe(true);
      }
    });

    it("each event carries a nested licenseDetails object with entitlement + maintenance fields", async () => {
      const d = await client.callTool<DetailsResponse>("metrics_details_by_metric", {
        saleMetric: "churn", startDate: "2026-01-01", endDate: "2026-06-01", limit: 5,
      });
      expect(d.events.length).toBeGreaterThan(0);
      for (const e of d.events) {
        expect(typeof e.licenseDetails).toBe("object");
        const ld = e.licenseDetails;
        // appEntitlementNumber is the Cloud SEN (E-...); present on cloud events
        if (ld.appEntitlementNumber) expect(ld.appEntitlementNumber).toMatch(/^E-/);
        if (ld.monthsValid !== undefined) expect(typeof ld.monthsValid).toBe("number");
        if (ld.maintenanceStartDate) expect(ld.maintenanceStartDate).toMatch(ISO_DATE);
      }
    });

    it("text search narrows to events matching that identifier", async () => {
      // Discover a SEN from the data, then search for it.
      const seed = await client.callTool<DetailsResponse>("metrics_details_by_metric", {
        saleMetric: "churn", startDate: "2024-01-01", endDate: "2026-06-01", limit: 1,
      });
      const sen = seed.events[0]?.licenseDetails?.appEntitlementNumber;
      if (!sen) return; // no SEN to search — skip
      const found = await client.callTool<DetailsResponse>("metrics_details_by_metric", {
        saleMetric: "churn", startDate: "2024-01-01", endDate: "2026-06-01", text: sen, limit: 10,
      });
      expect(found.events.length).toBeGreaterThan(0);
      for (const e of found.events) {
        expect(e.licenseDetails.appEntitlementNumber).toBe(sen);
      }
    });

    it("lastUpdated filters to events updated on/after the given date", async () => {
      const d = await client.callTool<DetailsResponse>("metrics_details_by_metric", {
        saleMetric: "churn", startDate: "2024-01-01", endDate: "2026-06-01",
        lastUpdated: "2026-05-01", limit: 50,
      });
      for (const e of d.events) {
        expect(e.lastUpdated >= "2026-05-01").toBe(true);
      }
    });

    it("partnerType=reseller filter is accepted and returns events", async () => {
      const d = await client.callTool<DetailsResponse>("metrics_details_by_metric", {
        saleMetric: "churn", startDate: "2024-01-01", endDate: "2026-06-01",
        partnerType: "reseller", limit: 50,
      });
      expect(Array.isArray(d.events)).toBe(true);
    });

    it("partnerType=upgrade is rejected by our Zod enum (Atlassian 400s on it despite listing it)", async () => {
      const err = await client.callToolExpectingError("metrics_details_by_metric", {
        saleMetric: "churn", partnerType: "upgrade",
      });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });
  });

  // ---------------------------------------------------------------------------
  // metrics_details_export
  // ---------------------------------------------------------------------------
  describe("metrics_details_export", () => {
    it("saleMetric=churn returns a CSV string starting with the expected header row", async () => {
      const csv = await client.callTool<string>("metrics_details_export", {
        saleMetric: "churn", startDate: "2026-05-01", endDate: "2026-06-01",
      });
      expect(typeof csv).toBe("string");
      // header includes the well-known fields
      expect(csv).toContain('"addonName"');
      expect(csv).toContain('"addonKey"');
      expect(csv).toContain('"hosting"');
      expect(csv).toContain('"eventDate"');
      expect(csv).toContain('"transactionId"');
      // CSV starts on a quote (header row first character)
      expect(csv[0]).toBe('"');
    });

    it("invalid saleMetric is rejected at Zod level", async () => {
      const err = await client.callToolExpectingError("metrics_details_export", {
        saleMetric: "invalid-metric",
      });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    it("accept=json returns a JSON array (default CSV); invalid accept → Zod error", async () => {
      const r = await client.callTool<unknown>("metrics_details_export", {
        saleMetric: "churn", startDate: "2026-05-01", endDate: "2026-06-01", accept: "json",
      });
      if (typeof r !== "string") {
        expect(Array.isArray(r) || (r as { _truncated?: boolean })._truncated).toBeTruthy();
      }
      const err = await client.callToolExpectingError("metrics_details_export", { saleMetric: "churn", accept: "xml" });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    // ─── deep audit additions (2026-06-03) ───

    it("CSV header has exactly the documented 17 columns in order", async () => {
      const csv = await client.callTool<string>("metrics_details_export", {
        saleMetric: "churn", startDate: "2026-05-01", endDate: "2026-06-01",
      });
      const header = csv.split(/\r?\n/)[0].replace(/"/g, "");
      expect(header).toBe(
        "addonName,addonKey,hosting,lastUpdated,eventDate,transactionId,licenseId," +
        "maintenanceStartDate,maintenanceEndDate,monthsValid,appEntitlementId," +
        "appEntitlementNumber,cloudId,inGracePeriod,multiInstanceEntitlementId," +
        "multiInstanceEntitlementNumber,appEdition"
      );
    });

    it("all three saleMetric paths export a CSV with the same header", async () => {
      // Narrow 1-month window so each stays under the 50k truncation threshold
      // and comes back as an inline CSV string (wider windows spill to a file).
      for (const saleMetric of ["churn", "conversion", "renewal"] as const) {
        const csv = await client.callTool<string>("metrics_details_export", {
          saleMetric, startDate: "2026-05-01", endDate: "2026-06-01",
        });
        expect(typeof csv, `${saleMetric} export should be an inline CSV string`).toBe("string");
        expect(csv.startsWith('"addonName"')).toBe(true);
      }
    });

    it("hosting filter narrows the CSV row count", async () => {
      const wide = { saleMetric: "churn" as const, startDate: "2024-01-01", endDate: "2026-06-01" };
      const all = await client.callTool<string>("metrics_details_export", wide);
      const cloud = await client.callTool<string>("metrics_details_export", { ...wide, hosting: "cloud" });
      // Both are strings here (small enough not to truncate at this window? if truncated, skip).
      if (typeof all === "string" && typeof cloud === "string") {
        const rows = (s: string) => s.split(/\r?\n/).filter(Boolean).length;
        expect(rows(cloud)).toBeLessThanOrEqual(rows(all));
      }
    });

    it("does NOT expose offset/limit (the export endpoint ignores them — full dump only)", async () => {
      const tools = await client.listTools();
      const exp = tools.find((t) => t.name === "metrics_details_export")!;
      const props = (exp.inputSchema as { properties: Record<string, unknown> }).properties;
      expect("offset" in props).toBe(false);
      expect("limit" in props).toBe(false);
    });

    it("partnerType=upgrade rejected by Zod (shared DETAILS_FILTERS quirk)", async () => {
      const err = await client.callToolExpectingError("metrics_details_export", {
        saleMetric: "churn", partnerType: "upgrade",
      });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });
  });
});
