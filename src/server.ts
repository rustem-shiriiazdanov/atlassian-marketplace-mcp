#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPromotionTools } from "./tools/promotions.js";
import { registerLicenseTools } from "./tools/licenses.js";
import { registerTransactionTools } from "./tools/transactions.js";
import { registerAppTools } from "./tools/apps.js";
import { registerReportingMetaTools } from "./tools/reporting-meta.js";
import { registerEvaluationTools } from "./tools/evaluations.js";
import { registerFeedbackTools } from "./tools/feedback.js";
import { registerCustomerInsightTools } from "./tools/customer-insights.js";
import { registerSalesMetricsTools } from "./tools/sales-metrics.js";
import { registerBenchmarkTools } from "./tools/benchmarks.js";
import { registerMarketingAttributionTools } from "./tools/marketing-attribution.js";
import { registerAppRequestTools } from "./tools/app-requests.js";
import { registerReviewTools } from "./tools/reviews.js";
import { registerSearchKeywordTools } from "./tools/search-keywords.js";
import { registerFreeStarterTools } from "./tools/free-starter.js";
import { registerAppListingTools } from "./tools/app-listing.js";
import { registerAppSoftwareTools } from "./tools/app-software.js";
import { registerAppVersionListingTools } from "./tools/app-version-listing.js";
import { registerPrivacySecurityTools } from "./tools/privacy-security.js";
import { registerMigrationTools } from "./tools/migrations.js";
import { registerParentSoftwareTools } from "./tools/parent-software.js";
import { registerDeveloperSpaceTools } from "./tools/developer-space.js";
import { registerPartnerMetricsTools } from "./tools/partner-metrics.js";
import { registerProductCatalogTools } from "./tools/product-catalog.js";
import { registerArtifactTools } from "./tools/artifacts.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";
import { TOOL_ENDPOINTS, specUrl } from "./tools/_spec-links.js";

/**
 * Wrap `server.tool` so every registered tool's description is auto-augmented
 * with a "📖 Spec:" link to its canonical Atlassian docs URL.
 *
 * Single source of truth: `src/tools/_spec-links.ts → TOOL_ENDPOINTS`.
 * Tools whose name isn't in that map are registered unchanged (good defensive default).
 */
function patchToolRegistrationForSpecLinks(server: McpServer): void {
  const original = server.tool.bind(server);
  // The MCP SDK has many overloads of `tool()`; we only need to inject into the
  // (name, description, ...) shape we actually use. Other shapes are passed through.
  (server as { tool: (...args: unknown[]) => unknown }).tool = function patched(...args: unknown[]) {
    const name = args[0];
    const description = args[1];
    if (typeof name === "string" && typeof description === "string") {
      const ep = TOOL_ENDPOINTS[name];
      if (ep) {
        const url = specUrl(ep.method, ep.path);
        const noteSuffix = ep.note ? ` — ${ep.note}` : "";
        args[1] = `${description}\n\n📖 Spec (${ep.method} ${ep.path}${noteSuffix}): ${url}`;
      }
    }
    return (original as (...a: unknown[]) => unknown)(...args);
  };
}

async function main() {
  const server = new McpServer({
    name: "atlassian-marketplace-mcp",
    version: "0.1.0",
  });

  patchToolRegistrationForSpecLinks(server);

  registerAppTools(server);
  registerPromotionTools(server);
  registerLicenseTools(server);
  registerTransactionTools(server);
  registerReportingMetaTools(server);
  registerEvaluationTools(server);
  registerFeedbackTools(server);
  registerCustomerInsightTools(server);
  registerSalesMetricsTools(server);
  registerBenchmarkTools(server);
  registerMarketingAttributionTools(server);
  registerAppRequestTools(server);
  registerReviewTools(server);
  registerSearchKeywordTools(server);
  registerFreeStarterTools(server);
  registerAppListingTools(server);
  registerAppSoftwareTools(server);
  registerAppVersionListingTools(server);
  registerPrivacySecurityTools(server);
  registerMigrationTools(server);
  registerParentSoftwareTools(server);
  registerDeveloperSpaceTools(server);
  registerPartnerMetricsTools(server);
  registerProductCatalogTools(server);
  registerArtifactTools(server);

  registerResources(server);
  registerPrompts(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[atlassian-marketplace-mcp] fatal:", err);
  process.exit(1);
});
