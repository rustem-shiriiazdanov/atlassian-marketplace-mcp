/**
 * Unit tests for tool→spec URL building (src/tools/_spec-links.ts).
 *
 * Verifies the slugifier and the v1/v4 routing without hitting the network.
 * Combined with `scripts/verify-spec-urls.mjs` (which checks every URL is live),
 * these guarantee both shape AND existence.
 */
import { describe, it, expect } from "vitest";
import { specUrl, toolSpecUrl, TOOL_ENDPOINTS } from "../../src/tools/_spec-links.js";

describe("specUrl", () => {
  it("builds v4 anchor for reporting paths (modern API)", () => {
    const u = specUrl("GET", "/rest/3/reporting/developer-space/{developerId}/licenses");
    expect(u).toBe(
      "https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/" +
      "#api-rest-3-reporting-developer-space-developerid-licenses-get"
    );
  });

  it("builds v1 anchor for promotions paths (v1 wire path → v1 docs)", () => {
    const u = specUrl("POST", "/catalog/partners/{partnerId}/promotions");
    expect(u).toContain("/rest/v1/api-group-promotions/");
    // v1 anchors include the /marketplace/ prefix
    expect(u).toContain("#api-marketplace-catalog-partners-partnerid-promotions-post");
  });

  it("lowercases the HTTP method in the anchor suffix", () => {
    const u = specUrl("DELETE", "/rest/3/reporting/developer-space/{developerId}/foo");
    expect(u.endsWith("-delete")).toBe(true);
  });

  it("strips query-template chars (`?`, `&`, `=`) into `/` for the anchor slug", () => {
    const u = specUrl(
      "GET",
      "/rest/3/reporting/developer-space/{developerId}/members?limit={limit}&cursor={cursor}"
    );
    // No raw query-template chars should remain in the anchor
    expect(u).not.toMatch(/[?&=]/);
  });

  it("treats path variables in {braces} as part of the slug", () => {
    const u = specUrl("GET", "/rest/3/reporting/developer-space/{developerId}/licenses/{exportId}");
    expect(u).toContain("developer-space-developerid-licenses-exportid-get");
  });
});

describe("toolSpecUrl", () => {
  it("returns the same URL specUrl would build for a known tool name", () => {
    const ep = TOOL_ENDPOINTS.licenses_list;
    expect(ep).toBeDefined();
    expect(toolSpecUrl("licenses_list")).toBe(specUrl(ep.method, ep.path));
  });

  it("returns null for unknown tool names (graceful, not throwing)", () => {
    expect(toolSpecUrl("does_not_exist")).toBeNull();
  });
});

describe("TOOL_ENDPOINTS coverage", () => {
  it("contains exactly 95 tool mappings (matches our public surface)", () => {
    expect(Object.keys(TOOL_ENDPOINTS).length).toBe(95);
  });

  it("every entry has a method, path; note is optional", () => {
    for (const [name, ep] of Object.entries(TOOL_ENDPOINTS)) {
      expect(ep.method, `${name}.method`).toMatch(/^(GET|POST|PATCH|PUT|DELETE)$/);
      expect(ep.path, `${name}.path`).toMatch(/^\//);
    }
  });
});
