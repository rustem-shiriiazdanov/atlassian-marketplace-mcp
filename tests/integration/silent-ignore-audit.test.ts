/**
 * Regression test for the "silent-ignore" audit (2026-06-02).
 *
 * The metrics_churn aggregate endpoint is documented (via HAL `_links.query.href`)
 * to accept ONLY `aggregation, startDate, endDate`. We probed it with 30 plausible
 * filter names from other reporting endpoints + a fabricated `foo=bar`, and EVERY
 * extra param was silently ignored (byte-identical response, only `_links.self.href`
 * echoed the param back).
 *
 * Our schema is built on top of that knowledge. If Atlassian ever starts honoring
 * one of these params, the response data will change and this test will fail —
 * forcing us to revisit our schema and our `metrics_churn` description.
 *
 * Live API. Bypasses MCP and calls Atlassian directly because our MCP schema
 * strips unknown params by design (which is the right behavior — but means we
 * can't test the upstream silent-ignore through it).
 */
import "dotenv/config";
import { describe, it, expect, beforeAll } from "vitest";
import { createHash } from "node:crypto";
import { hasLiveCreds, McpTestClient } from "../helpers/mcp-test-client.js";
import { discoverFixtures } from "../helpers/fixtures.js";

/**
 * Parameter names + filler values to probe. The values themselves are arbitrary —
 * the point is whether Atlassian's response data changes when ANY of these are
 * present. Vendor-specific identifiers (productId, addon, text) are populated
 * dynamically from the running dev space at startup.
 */
type ParamCase = [string, string];

function buildParamCases(productId: string, addonKey: string): ParamCase[] {
  return [
    ["productId", productId],
    ["hosting", "cloud"],
    ["hosting", "datacenter"],
    ["hosting", "server"],
    ["addon", addonKey],
    ["addonKey", addonKey],
    ["app", addonKey],
    ["tier", "10"],
    ["country", "DE"],
    ["region", "EMEA"],
    ["partnerType", "direct"],
    ["licenseType", "commercial"],
    ["status", "active"],
    ["text", "license"], // generic English word, not vendor name
    ["saleType", "new"],
    ["paymentStatus", "paid"],
    ["billingPeriod", "monthly"],
    ["excludeZeroTransactions", "true"],
    ["withDataInsights", "true"],
    ["withAttribution", "true"],
    ["lastUpdated", "2026-05-01"],
    ["appEdition", "free"],
    ["licenseLevel", "single-instance"],
    ["cloudComplianceBoundaries", "commercial"],
    ["includeAtlassianLicenses", "true"],
    ["sortBy", "addonName"],
    ["order", "asc"],
    ["offset", "5"],
    ["limit", "10"],
    ["dateType", "start"],
    ["foo", "bar"], // fabricated, proves silent-accept
  ];
}

function basicAuth(): string {
  return "Basic " + Buffer.from(`${process.env.ATLASSIAN_EMAIL}:${process.env.ATLASSIAN_API_TOKEN}`).toString("base64");
}

async function fetchChurn(extra?: [string, string], attempt = 0): Promise<unknown> {
  const base = `https://api.atlassian.com/marketplace/rest/3/reporting/developer-space/${process.env.MARKETPLACE_DEVELOPER_ID}/sales/metrics/churn`;
  const url = new URL(base);
  url.searchParams.set("aggregation", "month");
  url.searchParams.set("startDate", "2026-04-01");
  url.searchParams.set("endDate", "2026-06-01");
  if (extra) url.searchParams.set(extra[0], extra[1]);
  const res = await fetch(url.toString(), { headers: { Authorization: basicAuth() } });
  if (res.status === 429 && attempt < 4) {
    // Honor Retry-After if present; else exponential backoff like our http-client.
    const ra = Number(res.headers.get("Retry-After"));
    const waitMs = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 10_000) : Math.min(2 ** attempt * 1000, 10_000);
    await new Promise((r) => setTimeout(r, waitMs));
    return fetchChurn(extra, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function hashWithoutSelf(d: any): string {
  const clone = JSON.parse(JSON.stringify(d));
  if (clone._links?.self) clone._links.self = null; // self.href echoes whatever query we sent
  return createHash("sha1").update(JSON.stringify(clone, Object.keys(clone).sort())).digest("hex").slice(0, 12);
}

// Populated dynamically in beforeAll — no hardcoded vendor identifiers.
let paramCases: ParamCase[] = [];

describe.skipIf(!hasLiveCreds())("Silent-ignore audit regression — metrics_churn (live API, bypasses MCP)", () => {
  let baselineHash: string;
  let baselineKeys: string[];

  beforeAll(async () => {
    // Discover a real productId + app key from this dev space.
    const c = await McpTestClient.start();
    try {
      const fx = await discoverFixtures(c);
      paramCases = buildParamCases(fx.primary.productId, fx.primary.appKey);
    } finally {
      await c.close();
    }
    const baseline = await fetchChurn();
    baselineHash = hashWithoutSelf(baseline);
    baselineKeys = Object.keys(baseline as object).sort();
    expect(baselineKeys).toEqual(["_links", "addons", "total"]);
  }, 60_000);

  it("runs the full param sweep against the live API and verifies each is silently ignored", async () => {
    expect(paramCases.length).toBeGreaterThan(20);
    for (const [name, value] of paramCases) {
      const variant = await fetchChurn([name, value]);
      const hash = hashWithoutSelf(variant);
      expect(
        hash,
        `param ${name}=${value} produced a DIFFERENT response than baseline — Atlassian may have changed behavior, revisit our metrics_churn schema`
      ).toBe(baselineHash);
    }
    // ~31 sequential live calls; with 429 backoff this can run long. Generous timeout.
  }, 300_000);
});
