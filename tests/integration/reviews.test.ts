/**
 * Integration tests for the Reviews tools.
 * Read tools (reviews_list, review_get) are exercised live. Write tools
 * (review_response_put PUBLIC, review_response_delete DESTRUCTIVE) are verified
 * statically only — never executed (they alter publicly-visible Marketplace state).
 * No hardcoded identifiers; reviews contain PII so we assert structure, not values.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";
import { discoverFixtures, type Fixtures } from "../helpers/fixtures.js";

interface Review {
  id: string; content: string; stars: number; date: string;
  totalVotes: number; helpfulVotes: number; productHosting: string;
  isFlagged: boolean; authorName: string; transitionedToFiveStarRating: boolean;
}
interface ReviewsResponse {
  productId: string; reviews: Review[]; cursor?: string; count: number; averageStars: number;
}

describe.skipIf(!hasLiveCreds())("Block E: Reviews tools (live API)", () => {
  let client: McpTestClient;
  let fx: Fixtures;
  let productWithReviews: string | null = null;
  beforeAll(async () => {
    client = await McpTestClient.start();
    fx = await discoverFixtures(client);
    // Find a product that actually has reviews (not all apps do).
    for (const app of fx.apps) {
      const r = await client.callTool<ReviewsResponse>("reviews_list", { productId: app.productId, limit: 1 });
      if (r.count > 0) { productWithReviews = app.productId; break; }
    }
  });
  afterAll(async () => { await client.close(); });

  describe("reviews_list", () => {
    it("returns cursor-paginated reviews with count + averageStars", async () => {
      if (!productWithReviews) return; // no reviews in this dev space
      const d = await client.callTool<ReviewsResponse>("reviews_list", { productId: productWithReviews, limit: 5 });
      expect(d.productId).toBe(productWithReviews);
      expect(Array.isArray(d.reviews)).toBe(true);
      expect(typeof d.count).toBe("number");
      expect(d.averageStars).toBeGreaterThanOrEqual(0);
      expect(d.averageStars).toBeLessThanOrEqual(5);
      for (const r of d.reviews) {
        expect(r.id).toEqual(expect.any(String));
        expect(r.stars).toBeGreaterThanOrEqual(1);
        expect(r.stars).toBeLessThanOrEqual(5);
        expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(typeof r.isFlagged).toBe("boolean");
      }
    });

    it("limit caps the page; cursor paginates to a disjoint page", async () => {
      if (!productWithReviews) return;
      const p1 = await client.callTool<ReviewsResponse>("reviews_list", { productId: productWithReviews, limit: 3 });
      expect(p1.reviews.length).toBeLessThanOrEqual(3);
      if (p1.cursor && p1.count > 3) {
        const p2 = await client.callTool<ReviewsResponse>("reviews_list", {
          productId: productWithReviews, limit: 3, cursor: p1.cursor,
        });
        const ids1 = new Set(p1.reviews.map((r) => r.id));
        const ids2 = p2.reviews.map((r) => r.id);
        expect(ids2.some((id) => ids1.has(id))).toBe(false); // disjoint
      }
    });

    it("schema is productId/hosting/sort/limit/cursor (offset/sortBy/order are not real params)", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "reviews_list")!;
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["cursor", "hosting", "limit", "productId", "sort"]);
    });

    it("sort=highest_rated returns stars in non-increasing order; sort=lowest_rated non-decreasing", async () => {
      if (!productWithReviews) return;
      const hi = await client.callTool<ReviewsResponse>("reviews_list", { productId: productWithReviews, sort: "highest_rated", limit: 10 });
      for (let i = 1; i < hi.reviews.length; i++) expect(hi.reviews[i].stars).toBeLessThanOrEqual(hi.reviews[i - 1].stars);
      const lo = await client.callTool<ReviewsResponse>("reviews_list", { productId: productWithReviews, sort: "lowest_rated", limit: 10 });
      for (let i = 1; i < lo.reviews.length; i++) expect(lo.reviews[i].stars).toBeGreaterThanOrEqual(lo.reviews[i - 1].stars);
    });

    it("invalid sort value is rejected by our Zod enum", async () => {
      const err = await client.callToolExpectingError("reviews_list", { productId: fx.primary.productId, sort: "bogus" });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    it("hosting filter narrows reviews to that platform (cloud/server/datacenter)", async () => {
      if (!productWithReviews) return;
      for (const hosting of ["cloud", "server", "datacenter"] as const) {
        const d = await client.callTool<ReviewsResponse>("reviews_list", {
          productId: productWithReviews, hosting, limit: 50,
        });
        for (const r of d.reviews) expect(r.productHosting).toBe(hosting);
      }
    });

    it("invalid hosting value is rejected by our Zod enum", async () => {
      const err = await client.callToolExpectingError("reviews_list", {
        productId: fx.primary.productId, hosting: "data-center",
      });
      expect(err.toLowerCase()).toMatch(/invalid|enum|expected/);
    });

    it("a product with zero reviews returns {reviews:[], count:0} (graceful empty)", async () => {
      // find a zero-review product in this dev space
      let emptyProduct: string | null = null;
      for (const app of fx.apps) {
        const r = await client.callTool<ReviewsResponse>("reviews_list", { productId: app.productId, limit: 1 });
        if (r.count === 0) { emptyProduct = app.productId; break; }
      }
      if (!emptyProduct) return; // every app has reviews — nothing to assert
      const d = await client.callTool<ReviewsResponse>("reviews_list", { productId: emptyProduct, limit: 5 });
      expect(d.reviews).toEqual([]);
      expect(d.count).toBe(0);
    });

    it("limit > 50 is rejected by our Zod max()", async () => {
      const err = await client.callToolExpectingError("reviews_list", {
        productId: fx.primary.productId, limit: 999,
      });
      expect(err.toLowerCase()).toMatch(/50|max|too|big/);
    });

    it("requires productId (Zod)", async () => {
      const err = await client.callToolExpectingError("reviews_list", {});
      expect(err.toLowerCase()).toMatch(/productid|required|invalid/);
    });
  });

  describe("review_get", () => {
    it("fetches a single review by id (chained from reviews_list)", async () => {
      if (!productWithReviews) return;
      const list = await client.callTool<ReviewsResponse>("reviews_list", { productId: productWithReviews, limit: 1 });
      const reviewId = list.reviews[0]?.id;
      if (!reviewId) return;
      const r = await client.callTool<Review>("review_get", { productId: productWithReviews, reviewId });
      expect(r.id).toBe(reviewId);
      expect(r.stars).toBeGreaterThanOrEqual(1);
      expect(r.stars).toBeLessThanOrEqual(5);
    });

    it("requires productId and reviewId (Zod)", async () => {
      const err = await client.callToolExpectingError("review_get", { productId: fx.primary.productId });
      expect(err.toLowerCase()).toMatch(/reviewid|required|invalid/);
    });

    it("a bogus reviewId surfaces an error (not a silent empty success)", async () => {
      const err = await client.callToolExpectingError("review_get", {
        productId: fx.primary.productId, reviewId: "000000000000000000000000",
      });
      expect(err.length).toBeGreaterThan(0);
    });
  });

  describe("write tools (static verification only — never executed)", () => {
    it("review_response_put is annotated as a write (PUT) and requires response text", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "review_response_put")!;
      const ann = t.annotations as { readOnlyHint?: boolean; destructiveHint?: boolean };
      expect(ann.readOnlyHint).not.toBe(true);
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["productId", "response", "reviewId"]);
      // Zod rejects a missing response without sending anything to Atlassian
      const err = await client.callToolExpectingError("review_response_put", {
        productId: fx.primary.productId, reviewId: "x",
      });
      expect(err.toLowerCase()).toMatch(/response|required|invalid/);
    });

    it("review_response_delete is annotated destructive and requires productId+reviewId", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "review_response_delete")!;
      const ann = t.annotations as { destructiveHint?: boolean };
      expect(ann.destructiveHint).toBe(true);
      const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(props).sort()).toEqual(["productId", "reviewId"]);
    });
  });
});
