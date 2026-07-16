/**
 * Dynamic test fixtures.
 *
 * Tests must NOT hardcode vendor-specific identifiers (app keys, product IDs,
 * SENs) — those leak the credential owner's business details and break when
 * any other user runs the suite.
 *
 * Instead, every test file calls `discoverFixtures(client)` once in
 * `beforeAll` and uses `fx.apps[0]`, `fx.firstSen` etc. The dev space that
 * the running creds point to dictates the data.
 */
import type { McpTestClient } from "./mcp-test-client.js";

export interface AppFixture {
  appKey: string;     // e.g. "vendor.product.key"
  productId: string;  // UUID
  name?: string;
}

export interface Fixtures {
  /** All apps the running developer-space exposes, in apps_list order. */
  apps: AppFixture[];
  /** First app, for convenience in single-app tests. */
  primary: AppFixture;
  /** Second app (if available) — used for multi-app filtering tests. */
  secondary?: AppFixture;
  /** A known SEN that has at least one license; null if none in this space. */
  firstSen: string | null;
}

interface AppsListResponse {
  // apps_list uses `appKey`/`appName` (not addonKey/addonName which other
  // endpoints use — Atlassian-side inconsistency).
  apps: Array<{ appKey: string; appName?: string; productId: string }>;
  nextCursor?: string | null;
}

interface LicensesListResponse {
  licenses: Array<{ appEntitlementNumber: string }>;
}

export async function discoverFixtures(client: McpTestClient): Promise<Fixtures> {
  // 1. List apps in the running developer space. apps_list is cursor-paginated
  //    (default 10/page); follow `nextCursor` so spaces with >10 apps are fully
  //    discovered.
  const rawApps: AppsListResponse["apps"] = [];
  let cursor: string | null | undefined;
  do {
    const page = await client.callTool<AppsListResponse>("apps_list", cursor ? { limit: 50, cursor } : { limit: 50 });
    rawApps.push(...(page.apps ?? []));
    cursor = page.nextCursor;
  } while (cursor);
  if (rawApps.length === 0) {
    throw new Error("test fixtures: developer space exposes 0 apps; cannot drive most tests");
  }
  const apps: AppFixture[] = rawApps.map((a) => ({
    appKey: a.appKey,
    productId: a.productId,
    name: a.appName,
  }));

  // 2. Try to pick the first SEN from the first app's licenses (used by text-search tests).
  let firstSen: string | null = null;
  try {
    const lic = await client.callTool<LicensesListResponse>("licenses_list", {
      productId: apps[0].productId,
      limit: 1,
    });
    firstSen = lic.licenses?.[0]?.appEntitlementNumber ?? null;
  } catch {
    // Some product IDs may not have licenses; ignore — tests that need a SEN
    // can check `fx.firstSen != null` and skip.
  }

  return {
    apps,
    primary: apps[0],
    secondary: apps[1],
    firstSen,
  };
}
