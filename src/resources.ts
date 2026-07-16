import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { request } from "./http-client.js";
import { config } from "./config.js";

interface AppListing {
  productId: string;
  appKey: string;
  appName: string;
  state?: string;
  approvalStatus?: string;
  slug?: string;
}

let appsCache: { fetchedAt: number; items: AppListing[] } | null = null;
const APPS_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getApps(): Promise<AppListing[]> {
  if (appsCache && Date.now() - appsCache.fetchedAt < APPS_TTL_MS) return appsCache.items;
  const data = await request<{ items: AppListing[] }>({
    path: `/rest/3/product-listing/developer-space/${config.developerId}`,
  });
  appsCache = { fetchedAt: Date.now(), items: data.items ?? [] };
  return appsCache.items;
}

export function registerResources(server: McpServer): void {
  // apps://list — the canonical list of this developer-space's apps
  server.resource(
    "apps-list",
    "apps://list",
    {
      description: "All apps in this developer space (productId, appKey, appName, state). Live, 5-minute cached.",
      mimeType: "application/json",
    },
    async (uri) => {
      const items = await getApps();
      const summary = items.map((a) => ({
        productId: a.productId,
        appKey: a.appKey,
        appName: a.appName,
        state: a.state,
        approvalStatus: a.approvalStatus,
      }));
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ count: summary.length, apps: summary }, null, 2),
          },
        ],
      };
    }
  );

  // apps://known — env-defined friendly-name → productId map
  server.resource(
    "apps-known",
    "apps://known",
    {
      description: "Friendly-name → productId map loaded from PRODUCT_ID_* env vars. Static, no API call.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(config.knownProductIds, null, 2),
        },
      ],
    })
  );

  // vendor://profile — developer-space profile metadata
  server.resource(
    "vendor-profile",
    "vendor://profile",
    {
      description: "Developer-space profile: developerId, partnerId, contact info, address. Pulled live.",
      mimeType: "application/json",
    },
    async (uri) => {
      const data = await request({
        path: `/rest/3/developer-space/${config.developerId}`,
      });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );
}
