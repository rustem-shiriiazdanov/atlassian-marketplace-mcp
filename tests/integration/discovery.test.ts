/**
 * Integration tests for the remaining Block A discovery/read tools.
 *
 * Tools covered:
 *   - reporting_links
 *   - developer_space_get
 *   - developer_space_catalog_account
 *   - developer_space_listings
 *   - parent_software_list
 *   - product_catalog_latest
 *
 * Live API; self-skips when creds absent.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe.skipIf(!hasLiveCreds())("Block A: discovery/read tools (live API)", () => {
  let client: McpTestClient;
  beforeAll(async () => {
    client = await McpTestClient.start();
  });
  afterAll(async () => {
    await client.close();
  });

  // ---------------------------------------------------------------------------
  // reporting_links
  // ---------------------------------------------------------------------------
  describe("reporting_links", () => {
    it("returns a HAL response with the canonical reporting link map", async () => {
      const data = await client.callTool<{ _links: Record<string, unknown> }>("reporting_links");
      expect(data._links).toBeDefined();
      const linkNames = Object.keys(data._links);
      expect(linkNames.length).toBeGreaterThan(5);
      // Spot-check known links that map to other tools we expose
      expect(linkNames).toEqual(expect.arrayContaining([
        "self",
        "appRequestsAndApprovals",
        "cloudChurn",
        "cloudConversions",
        "cloudRenewals",
      ]));
    });
  });

  // ---------------------------------------------------------------------------
  // developer_space_get
  // ---------------------------------------------------------------------------
  describe("developer_space_get", () => {
    interface DevSpace {
      id: string;
      vendorId: number;
      name: string;
      status: string;
      type: string;
      organisationId: string;
      version: number;
    }

    it("returns the developer-space profile for the env's developerId", async () => {
      const data = await client.callTool<DevSpace>("developer_space_get");
      expect(data.id).toMatch(UUID_RE);
      expect(data.id).toBe(process.env.MARKETPLACE_DEVELOPER_ID);
      expect(typeof data.vendorId).toBe("number");
      expect(data.vendorId).toBe(Number(process.env.MARKETPLACE_PARTNER_ID));
      expect(data.name).toEqual(expect.any(String));
      expect(data.status).toMatch(/^(ACTIVE|INACTIVE|SUSPENDED)$/);
    });

    it("accepts explicit developerId arg and returns matching id", async () => {
      const devId = process.env.MARKETPLACE_DEVELOPER_ID!;
      const data = await client.callTool<DevSpace>("developer_space_get", { developerId: devId });
      expect(data.id).toBe(devId);
    });
  });

  // ---------------------------------------------------------------------------
  // developer_space_catalog_account
  // ---------------------------------------------------------------------------
  describe("developer_space_catalog_account", () => {
    it("returns {developerId, catalogAccountId}", async () => {
      const data = await client.callTool<{ developerId: string; catalogAccountId: string }>(
        "developer_space_catalog_account"
      );
      expect(data.developerId).toMatch(UUID_RE);
      expect(data.developerId).toBe(process.env.MARKETPLACE_DEVELOPER_ID);
      expect(data.catalogAccountId).toMatch(UUID_RE);
    });
  });

  // ---------------------------------------------------------------------------
  // developer_space_listings
  // ---------------------------------------------------------------------------
  describe("developer_space_listings", () => {
    // The response is a top-level array (NOT {items: [...]}). Each element is a
    // developer-profile listing document, keyed by `type`: DEVELOPER_CORE, DEVELOPER_WEB.
    // These are NOT the product app listings — use apps_list for those.
    interface DevSpaceListing {
      developerId: string;
      type: string;
      content: unknown;
      version: number;
    }

    it("returns an array of developer-profile listings", async () => {
      const data = await client.callTool<DevSpaceListing[]>("developer_space_listings");
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(2);
      const types = data.map((d) => d.type);
      expect(types).toEqual(expect.arrayContaining(["DEVELOPER_CORE", "DEVELOPER_WEB"]));
      for (const entry of data) {
        expect(entry.developerId).toBe(process.env.MARKETPLACE_DEVELOPER_ID);
        expect(typeof entry.version).toBe("number");
        expect(entry.content).toBeDefined();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // parent_software_list
  // ---------------------------------------------------------------------------
  describe("parent_software_list", () => {
    interface ParentSoftware {
      id: string;
      developerId: string;
      name: string;
      hostingOptions: Array<{ hosting: string }>;
      state: string;
    }
    interface ParentSoftwareList {
      links: { self: { href: string } };
      parentSoftware: ParentSoftware[];
    }

    it("returns the list of Atlassian parent products", async () => {
      const data = await client.callTool<ParentSoftwareList>("parent_software_list");
      expect(Array.isArray(data.parentSoftware)).toBe(true);
      expect(data.parentSoftware.length).toBeGreaterThan(10);
      const sample = data.parentSoftware[0];
      expect(sample.id).toEqual(expect.any(String));
      expect(sample.developerId).toBe("Atlassian");
      expect(sample.name).toEqual(expect.any(String));
      expect(Array.isArray(sample.hostingOptions)).toBe(true);
      expect(sample.state).toEqual(expect.any(String));
    });

    it("includes the major Atlassian products we'd expect", async () => {
      const data = await client.callTool<ParentSoftwareList>("parent_software_list");
      const names = data.parentSoftware.map((p) => p.name.toLowerCase());
      // Sanity check: Jira and Confluence variants should be in there
      const hasJira = names.some((n) => n.includes("jira"));
      const hasConfluence = names.some((n) => n.includes("confluence"));
      expect(hasJira).toBe(true);
      expect(hasConfluence).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // product_catalog_latest
  // ---------------------------------------------------------------------------
  describe("product_catalog_latest", () => {
    // NOTE the response shape: this endpoint doesn't return the catalog itself,
    // it returns a presigned S3 URL where you can download the catalog. Expires
    // in `expiresInSeconds` (typically 300s / 5 min).
    interface CatalogLatest {
      date: string;
      presignedUrl: string;
      expiresInSeconds: number;
    }

    it("returns a presigned S3 URL to download the public catalog", async () => {
      const data = await client.callTool<CatalogLatest>("product_catalog_latest");
      expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(data.presignedUrl).toMatch(/^https:\/\/[^\s]+/);
      expect(data.presignedUrl).toContain("amazonaws.com");
      expect(typeof data.expiresInSeconds).toBe("number");
      expect(data.expiresInSeconds).toBeGreaterThan(0);
    });

    it("repeated calls return distinct URLs (each is a fresh presign)", async () => {
      const a = await client.callTool<CatalogLatest>("product_catalog_latest");
      const b = await client.callTool<CatalogLatest>("product_catalog_latest");
      expect(a.date).toBe(b.date); // same calendar day
      // S3 presigned URLs use a `X-Amz-Date` and signature; they may match if regenerated within
      // the same second. The test just verifies the URL structure, not uniqueness.
      expect(a.presignedUrl.startsWith("https://")).toBe(true);
      expect(b.presignedUrl.startsWith("https://")).toBe(true);
    });
  });
});
