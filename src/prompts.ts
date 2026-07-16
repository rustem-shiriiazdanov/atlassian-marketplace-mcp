import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Canonical prompts for common Marketplace vendor workflows. These set up the
 * task framing for the LLM — they're not LLM completions themselves. The host
 * (Claude) renders the user-facing message and then uses the available tools
 * to actually do the work.
 */
export function registerPrompts(server: McpServer): void {
  server.prompt(
    "monthly_kpi_summary",
    "Generate a monthly KPI summary across sales, churn, evaluations, and customer insights.",
    {
      month: z.string().describe("Month in YYYY-MM format, e.g. 2026-05"),
      productId: z.string().optional().describe("Optional product UUID to scope to one app"),
    },
    ({ month, productId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Produce a one-page monthly KPI summary for ${month}` +
              (productId ? ` (scoped to productId=${productId})` : " (all apps)") +
              `.

Pull the following via MCP tools and synthesize into a table + commentary:
1. Transactions for the month: total revenue (transactions_list with startDate/endDate, sum amounts).
2. License events: licenses_list with dateType=start, count of new licenses.
3. Churn: metrics_churn for the month.
4. Conversion: metrics_conversion for the month.
5. Renewal: metrics_renewal for the month.
6. Evaluations: evaluations_by_metric(metric="month").
7. Customer insights snapshot: customer_insights_regions and customer_insights_tiers.
8. Top 5 search keywords: search_keywords_partner(limit=5).

Output:
- A table with each metric, this month's value, and (if available) the prior month for delta.
- 3 bullet points calling out notable changes.
- 1 recommended action (e.g. "investigate spike in EMEA churn", "double down on tier-3 conversion").`,
          },
        },
      ],
    })
  );

  server.prompt(
    "draft_review_response",
    "Draft a professional vendor response to a Marketplace review.",
    {
      productId: z.string().describe("Product UUID"),
      reviewId: z.string().describe("Review ID"),
      tone: z.enum(["thankful", "apologetic", "neutral", "investigative"]).optional()
        .describe("Tone of the response. Default: thankful for positive, apologetic for negative."),
    },
    ({ productId, reviewId, tone }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Draft a response to review ${reviewId} on product ${productId}.

Steps:
1. Call review_get to fetch the review text and rating.
2. If tone is unspecified, choose: thankful for 4-5 stars, apologetic + investigative for 1-2 stars, neutral for 3 stars.${tone ? ` Override: use "${tone}" tone.` : ""}
3. Draft a 3-5 sentence response that:
   - Acknowledges the specific point the reviewer raised (don't be generic).
   - Mentions one concrete next step (a fix planned, a docs link, an offer to email support).
   - Signs off with a real human name (use the vendor profile via vendor://profile if needed).

DO NOT submit the response — only output the draft for the user to review and edit. Once the user approves, call review_response_put with the final text.`,
          },
        },
      ],
    })
  );

  server.prompt(
    "customer_lookup",
    "Look up everything we know about a customer, given any identifier: SEN, Cloud appEntitlementNumber (E-...), appEntitlementId (UUID), cloudId, cloudSiteHostname, email, or organization name.",
    {
      identifier: z.string()
        .describe("Any customer identifier. Accepts: SEN (Server/DC, format `SEN-L########`), Cloud appEntitlementNumber (format `E-XXX-XXX-XXX-XXX`), appEntitlementId (UUID), cloudId, cloudSiteHostname (`<site>.atlassian.net`), contact email, or organization name."),
    },
    ({ identifier }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Pull a full snapshot of customer "${identifier}".

The 'text' parameter on licenses_list and transactions_list does free-text search across SEN, appEntitlementNumber, appEntitlementId, cloudId, cloudSiteHostname, email, and organization — so the same identifier passes through to both.

Steps:
1. licenses_list(text="${identifier}", showLicensesHistory=true, includeAtlassianLicenses=true, withDataInsights=true, withAttribution=true) — full license history + insights.
2. transactions_list(text="${identifier}", sortBy="date", order="desc") — purchase history including renewals and refunds. Note: zero results does NOT mean nothing was purchased — Cloud apps on Jira Free have COMMERCIAL licenses at $0 (check parentProductEdition and the tier).
3. If the license response includes a contact email, optionally feedback_details(text=<email>) for any feedback they've submitted.
4. If a Rovo/Atlassian MCP is connected, searchJiraIssuesUsingJql(jql='text ~ "${identifier}"') for any related support tickets.

Output:
- A single block with: customer name, organization, product, tier, hosting, license status, current maintenance end, total spend, renewal probability (commercial vs evaluation history).
- A short timeline of key events (purchase, renewal, refund, upgrade).
- Any open support tickets and their status.`,
          },
        },
      ],
    })
  );

  server.prompt(
    "promo_for_customer",
    "Create a single-use promo code for a specific customer with sensible defaults.",
    {
      customerName: z.string().describe("Customer organization name, used in the promo name"),
      appKey: z.string().describe("App key (e.g. com.example.your-app)"),
      discountPercent: z.string().describe("Discount percentage, e.g. '20'"),
      validForDays: z.string().optional().describe("Promo validity from today in days. Default 30."),
    },
    ({ customerName, appKey, discountPercent, validForDays }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Create a single-use promo for ${customerName} on app ${appKey} at ${discountPercent}% off.

Steps:
1. Compute expirationDate = today + ${validForDays ?? "30"} days.
2. Call promotions_create with:
   - name: "${customerName} - ${discountPercent}% (single-use)"
   - eligibleApps: ["${appKey}"]
   - expirationDate: <computed>
   - promotionType: SINGLE_USE_PROMOTION
   - discountType: FLAT_DISCOUNT
   - discountPercent: ${discountPercent}
   - hostingType: CLOUD (override if appKey indicates server/DC)
   - subscriptionType: ANNUAL (for cloud)
   - allowedBillingCycles: 1

3. Once created, immediately call promotions_codes_create with the new promotionId to mint the single-use code.
4. Then call promotions_code_get to surface the redemption code to the user.
5. Output the redemption code + expiration date in a copyable block.

CONFIRM the customer name and discount before calling promotions_create — promo codes are publicly redeemable once created.`,
          },
        },
      ],
    })
  );
}
