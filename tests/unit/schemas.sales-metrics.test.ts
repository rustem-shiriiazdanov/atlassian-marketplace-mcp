/**
 * Schema-level unit tests for sales-metrics.ts filter shapes.
 * Pure Zod parse — no MCP, no network. Catches schema regressions fast.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  AGGREGATE_FILTERS,
  BENCHMARK_FILTERS,
  DETAILS_FILTERS,
} from "../../src/tools/sales-metrics.js";

// Each filter set is an object literal of Zod fields. Wrap in z.object() to
// get a parseable schema. `.strip()` is the default behavior — unknown keys
// are dropped, matching how the MCP SDK wraps these for `server.tool(...)`.
const aggregateSchema = z.object(AGGREGATE_FILTERS);
const benchmarkSchema = z.object(BENCHMARK_FILTERS);
const detailsSchema   = z.object(DETAILS_FILTERS);

describe("AGGREGATE_FILTERS (metrics_churn / conversion / renewal)", () => {
  it("accepts all 3 documented params", () => {
    const r = aggregateSchema.safeParse({
      aggregation: "month",
      startDate: "2026-05-01",
      endDate: "2026-06-01",
    });
    expect(r.success).toBe(true);
  });

  it("accepts the empty object (all params optional)", () => {
    expect(aggregateSchema.safeParse({}).success).toBe(true);
  });

  it("aggregation enum: only 'week' or 'month'", () => {
    expect(aggregateSchema.safeParse({ aggregation: "week" }).success).toBe(true);
    expect(aggregateSchema.safeParse({ aggregation: "month" }).success).toBe(true);
    expect(aggregateSchema.safeParse({ aggregation: "daily" }).success).toBe(false);
    expect(aggregateSchema.safeParse({ aggregation: "WEEK" }).success).toBe(false);
    expect(aggregateSchema.safeParse({ aggregation: "" }).success).toBe(false);
  });

  it("STRIPS unknown keys (mirrors Atlassian's silent-ignore behavior — and prevents leakage to upstream)", () => {
    const r = aggregateSchema.parse({
      aggregation: "month",
      productId: "x",
      hosting: "cloud",
      foo: "bar",
    } as Record<string, unknown>);
    expect(r).toEqual({ aggregation: "month" });
    expect("productId" in r).toBe(false);
    expect("hosting" in r).toBe(false);
    expect("foo" in r).toBe(false);
  });

  it("rejects numeric startDate (must be string per Zod even though Atlassian validates format)", () => {
    expect(aggregateSchema.safeParse({ startDate: 20260501 }).success).toBe(false);
  });
});

describe("BENCHMARK_FILTERS (metrics_churn_benchmark)", () => {
  it("accepts addon (app key) + dates", () => {
    const r = benchmarkSchema.safeParse({
      addon: "example.vendor.app-one",
      startDate: "2026-01-01",
      endDate: "2026-06-01",
    });
    expect(r.success).toBe(true);
  });

  it("accepts productId (the undocumented-but-working filter)", () => {
    const r = benchmarkSchema.safeParse({
      productId: "00000000-0000-0000-0000-000000000001",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
    });
    expect(r.success).toBe(true);
  });

  it("accepts both addon AND productId (Atlassian-side: productId wins)", () => {
    const r = benchmarkSchema.safeParse({
      addon: "example.vendor.app-two",
      productId: "00000000-0000-0000-0000-000000000001",
    });
    expect(r.success).toBe(true);
  });

  it("strips unknown keys including aggregation (which is NOT supported on benchmark)", () => {
    const r = benchmarkSchema.parse({
      aggregation: "month",
      addon: "x.y",
    } as Record<string, unknown>);
    expect(r).toEqual({ addon: "x.y" });
    expect("aggregation" in r).toBe(false);
  });
});

describe("DETAILS_FILTERS (metrics_details_by_metric / _export)", () => {
  it("accepts the full rich filter set", () => {
    const r = detailsSchema.safeParse({
      addon: "example.vendor.app-two",
      hosting: "cloud",
      partnerType: "direct",
      text: "search",
      lastUpdated: "2026-05-01",
      startDate: "2026-05-01",
      endDate: "2026-06-01",
      sortBy: "addonName",
      order: "asc",
      offset: 0,
      limit: 50,
    });
    expect(r.success).toBe(true);
  });

  it("hosting enum: cloud | datacenter | server", () => {
    for (const h of ["cloud", "datacenter", "server"]) {
      expect(detailsSchema.safeParse({ hosting: h }).success).toBe(true);
    }
    expect(detailsSchema.safeParse({ hosting: "Data Center" }).success).toBe(false);
    expect(detailsSchema.safeParse({ hosting: "data_center" }).success).toBe(false);
  });

  it("partnerType enum: direct | expert | reseller (NOT upgrade — Atlassian 400s on it)", () => {
    for (const p of ["direct", "expert", "reseller"]) {
      expect(detailsSchema.safeParse({ partnerType: p }).success).toBe(true);
    }
    // `upgrade` is excluded — Atlassian rejects it despite listing it as allowable.
    expect(detailsSchema.safeParse({ partnerType: "upgrade" }).success).toBe(false);
    expect(detailsSchema.safeParse({ partnerType: "other" }).success).toBe(false);
  });

  it("sortBy enum exactly matches what Atlassian accepts (audit 2026-06-02)", () => {
    for (const s of ["addonName", "date", "hosting", "transactionId", "licenseId"]) {
      expect(detailsSchema.safeParse({ sortBy: s }).success).toBe(true);
    }
    // What Atlassian rejects — our Zod also rejects (catches the call before it goes out)
    expect(detailsSchema.safeParse({ sortBy: "eventDate" }).success).toBe(false);
    expect(detailsSchema.safeParse({ sortBy: "partnerType" }).success).toBe(false);
    expect(detailsSchema.safeParse({ sortBy: "lastUpdated" }).success).toBe(false);
  });

  it("limit caps at 50 (Atlassian's hard cap, enforced client-side)", () => {
    expect(detailsSchema.safeParse({ limit: 1 }).success).toBe(true);
    expect(detailsSchema.safeParse({ limit: 50 }).success).toBe(true);
    expect(detailsSchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(detailsSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(detailsSchema.safeParse({ limit: -1 }).success).toBe(false);
  });

  it("offset must be a non-negative integer", () => {
    expect(detailsSchema.safeParse({ offset: 0 }).success).toBe(true);
    expect(detailsSchema.safeParse({ offset: 100 }).success).toBe(true);
    expect(detailsSchema.safeParse({ offset: -1 }).success).toBe(false);
    expect(detailsSchema.safeParse({ offset: 1.5 }).success).toBe(false);
  });

  it("order enum: asc | desc only", () => {
    expect(detailsSchema.safeParse({ order: "asc" }).success).toBe(true);
    expect(detailsSchema.safeParse({ order: "desc" }).success).toBe(true);
    expect(detailsSchema.safeParse({ order: "ASC" }).success).toBe(false);
    expect(detailsSchema.safeParse({ order: "ascending" }).success).toBe(false);
  });
});
