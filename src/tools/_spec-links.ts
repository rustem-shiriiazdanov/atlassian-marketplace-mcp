/**
 * Canonical docs-URL builder for the Atlassian Marketplace API spec.
 *
 * Atlassian publishes per-endpoint anchors on developer.atlassian.com. The
 * docs site uses `/v4/` even though the URL paths we hit are `/rest/3/...`
 * (the `/v3/` docs path is the old v2 spec — irrelevant for us).
 *
 * Verified live on 2026-06-01: every endpoint we wrap resolves to a 200.
 *
 * URL shape for the modern reporting/listing API:
 * ```
 * https://developer.atlassian.com/platform/marketplace/rest/v4/<group>/#api-<slug>-<method>
 * ```
 * where `<slug>` is the path lowercased with `/` and `{}` replaced by `-`.
 *
 * The v1 Promotions API is documented separately (different version anchor):
 * ```
 * https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-<slug>-<method>
 * ```
 *
 * @example
 * ```ts
 * specUrl("GET", "/rest/3/reporting/developer-space/{developerId}/licenses")
 * // → .../v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-licenses-get
 * ```
 */

type Group =
  | "api-group-reporting"
  | "api-group-app-listing"
  | "api-group-app-software"
  | "api-group-app-version-listing"
  | "api-group-assets"
  | "api-group-developer-space"
  | "api-group-migrations"
  | "api-group-parent-software"
  | "api-group-privacy-and-security"
  | "api-group-reviews"
  | "api-group-promotions"; // v1 only

/** Map a path prefix to its docs group. Order matters — most specific first. */
function groupFor(path: string): Group {
  if (path.startsWith("/catalog/partners/")) return "api-group-promotions";
  if (path.includes("/reporting/")) return "api-group-reporting";
  if (path.includes("/partner-metrics/")) return "api-group-reporting"; // tagged with reporting in swagger
  if (path.includes("/cloud-migration-compatibility/")) return "api-group-migrations";
  if (path.includes("/privacy-and-security/")) return "api-group-privacy-and-security";
  if (path.includes("/parent-software")) return "api-group-parent-software";
  if (path.includes("/products/") && path.includes("/reviews")) return "api-group-reviews";
  if (path.includes("/product-listing")) return "api-group-app-listing";
  if (path.includes("/app-software/") && (path.includes("/listing") || path.includes("/listings"))) return "api-group-app-version-listing";
  if (path.includes("/app-software")) return "api-group-app-software";
  if (path.includes("/artifacts") || path.includes("/assets/")) return "api-group-assets";
  if (path.includes("/developer-space")) return "api-group-developer-space";
  return "api-group-reporting";
}

/** "v4" for the modern v3 wire API; "v1" for legacy promotions. */
function docsVersion(group: Group): "v1" | "v4" {
  return group === "api-group-promotions" ? "v1" : "v4";
}

/**
 * Build the canonical Atlassian docs URL for a Marketplace API endpoint.
 *
 * @param method HTTP method (case-insensitive)
 * @param path Endpoint path, with `{varName}` placeholders for path params
 * @returns Full URL with anchor that links directly to the endpoint's documentation
 */
export function specUrl(method: string, path: string): string {
  const group = groupFor(path);

  // Atlassian docs anchors for v1 promotions include the `/marketplace` prefix
  // that our wire base URL strips. The swagger path is `/marketplace/catalog/...`,
  // and the docs anchor mirrors the swagger, not our wire path. Restore it for
  // anchor-building only.
  let anchorPath = path;
  if (group === "api-group-promotions" && anchorPath.startsWith("/catalog/")) {
    anchorPath = "/marketplace" + anchorPath;
  }

  // Some swagger paths include query templates directly in the path string
  // (e.g., `/members?limit={limit}&&cursor={cursor}`). The docs anchor folds
  // those query params into the slug. Convert `?`, `&`, and `=` to `/` so the
  // slugifier turns them all into `-` separators.
  anchorPath = anchorPath.replace(/[?&=]+/g, "/");

  const slug = anchorPath
    .toLowerCase()
    .replace(/[{}]/g, "")
    .replace(/\//g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const anchor = `api-${slug}-${method.toLowerCase()}`;
  return `https://developer.atlassian.com/platform/marketplace/rest/${docsVersion(group)}/${group}/#${anchor}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Single source of truth: every tool's endpoint mapping.
// Used by:
//   - runtime tool descriptions (each tool appends its spec URL)
//   - docs/TOOLS.md regeneration (Spec column)
//   - register*Tools TSDoc (endpoint tables auto-generated)
//
// Tools that don't map to a single HTTP endpoint (e.g., apps_known, the
// transactions_aggregate_by_hosting alias) point at the closest reasonable
// reference — see comments inline.
// ────────────────────────────────────────────────────────────────────────────

export interface ToolEndpoint {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  /** Brief note when the mapping isn't 1:1 (e.g., aliases, local-only tools). */
  note?: string;
}

export const TOOL_ENDPOINTS: Record<string, ToolEndpoint> = {
  // ── Apps ────────────────────────────────────────────────────────────────────
  apps_list: { method: "GET", path: "/rest/3/product-listing/developer-space/{developerId}" },
  apps_known: { method: "GET", path: "/rest/3/product-listing/developer-space/{developerId}", note: "Local env map — closest related endpoint is apps_list" },

  // ── Promotions (v1) ─────────────────────────────────────────────────────────
  promotions_list_paged:    { method: "GET",    path: "/catalog/partners/{partnerId}/promotions/paged" },
  promotions_list:          { method: "GET",    path: "/catalog/partners/{partnerId}/promotions", note: "Deprecated non-paged variant; prefer promotions_list_paged" },
  promotions_create:        { method: "POST",   path: "/catalog/partners/{partnerId}/promotions" },
  promotions_get:           { method: "GET",    path: "/catalog/partners/{partnerId}/promotions/{promotionId}" },
  promotions_update:        { method: "PATCH",  path: "/catalog/partners/{partnerId}/promotions/{promotionId}" },
  promotions_status:        { method: "GET",    path: "/catalog/partners/{partnerId}/promotions/{promotionId}/status" },
  promotions_codes_list:    { method: "GET",    path: "/catalog/partners/{partnerId}/promotions/{promotionId}/codes" },
  promotions_codes_create:  { method: "POST",   path: "/catalog/partners/{partnerId}/promotions/{promotionId}/codes" },
  promotions_code_get:      { method: "GET",    path: "/catalog/partners/{partnerId}/promotions/{promotionId}/codes/{promotionCode}" },
  promotions_code_delete:   { method: "DELETE", path: "/catalog/partners/{partnerId}/promotions/{promotionId}/codes/{promotionCode}" },

  // ── Licenses ────────────────────────────────────────────────────────────────
  licenses_list:                    { method: "GET",  path: "/rest/3/reporting/developer-space/{developerId}/licenses" },
  licenses_export_sync:             { method: "GET",  path: "/rest/3/reporting/developer-space/{developerId}/licenses/export" },
  licenses_export_async_start:      { method: "POST", path: "/rest/3/reporting/developer-space/{developerId}/licenses/async/export" },
  licenses_export_async_status:     { method: "GET",  path: "/rest/3/reporting/developer-space/{developerId}/licenses/async/export/{exportId}/status" },
  licenses_export_async_download:   { method: "GET",  path: "/rest/3/reporting/developer-space/{developerId}/licenses/async/export/{exportId}" },

  // ── Transactions ────────────────────────────────────────────────────────────
  transactions_list:                  { method: "GET",  path: "/rest/3/reporting/developer-space/{developerId}/sales/transactions" },
  transactions_export_sync:           { method: "GET",  path: "/rest/3/reporting/developer-space/{developerId}/sales/transactions/export" },
  transactions_export_async_start:    { method: "POST", path: "/rest/3/reporting/developer-space/{developerId}/sales/transactions/async/export" },
  transactions_export_async_status:   { method: "GET",  path: "/rest/3/reporting/developer-space/{developerId}/sales/transactions/async/export/{exportId}/status" },
  transactions_export_async_download: { method: "GET",  path: "/rest/3/reporting/developer-space/{developerId}/sales/transactions/async/export/{exportId}" },
  transactions_aggregate_by_metric:   { method: "GET",  path: "/rest/3/reporting/developer-space/{developerId}/sales/transactions/{metric}" },
  transactions_aggregate_by_hosting:  { method: "GET",  path: "/rest/3/reporting/developer-space/{developerId}/sales/transactions/{metric}", note: "Friendly alias of transactions_aggregate_by_metric(metric='hosting')" },

  // ── Reporting meta ──────────────────────────────────────────────────────────
  reporting_links: { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}" },

  // ── Evaluations / Feedback ──────────────────────────────────────────────────
  evaluations_by_metric:        { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/evaluations/{metric}" },
  feedback_details:             { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/feedback/details" },
  feedback_metrics_by_metric:   { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/feedback/metrics/{metric}" },

  // ── Customer insights ───────────────────────────────────────────────────────
  customer_insights_regions:      { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/customer-insights/regions" },
  customer_insights_editions:     { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/customer-insights/editions" },
  customer_insights_tiers:        { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/customer-insights/tiers" },
  customer_insights_active_users: { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/customer-insights/active-users" },

  // ── Sales metrics ───────────────────────────────────────────────────────────
  metrics_churn:               { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/sales/metrics/churn" },
  metrics_churn_benchmark:     { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/sales/metrics/churn/benchmark" },
  metrics_conversion:          { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/sales/metrics/conversion" },
  metrics_renewal:             { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/sales/metrics/renewal" },
  metrics_details_by_metric:   { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/sales/metrics/{saleMetric}/details" },
  metrics_details_export:      { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/sales/metrics/{saleMetric}/details/export" },

  // ── Benchmarks ──────────────────────────────────────────────────────────────
  benchmark_sales:        { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/benchmark/sales" },
  benchmark_evaluations:  { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/benchmark/evaluations" },

  // ── Marketing attribution ───────────────────────────────────────────────────
  marketing_attribution_export_async_start:    { method: "POST", path: "/rest/3/reporting/developer-space/{developerId}/marketing-attribution/async/export" },
  marketing_attribution_export_async_status:   { method: "GET",  path: "/rest/3/reporting/developer-space/{developerId}/async/export/{exportId}/status" },
  marketing_attribution_export_async_download: { method: "GET",  path: "/rest/3/reporting/developer-space/{developerId}/async/export/{exportId}" },

  // ── App requests / Free starter ─────────────────────────────────────────────
  app_requests_and_approvals: { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/app-requests-and-approvals" },
  free_starter_tier_export:   { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/sales/freeStarterTier/export" },

  // ── Reviews ─────────────────────────────────────────────────────────────────
  reviews_list:              { method: "GET",    path: "/rest/3/products/{productId}/reviews" },
  review_get:                { method: "GET",    path: "/rest/3/products/{productId}/reviews/{reviewId}" },
  review_response_put:       { method: "PUT",    path: "/rest/3/products/{productId}/reviews/{reviewId}/response" },
  review_response_delete:    { method: "DELETE", path: "/rest/3/products/{productId}/reviews/{reviewId}/response" },

  // ── Search keywords ─────────────────────────────────────────────────────────
  search_keywords_partner:                 { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/search-keywords" },
  search_keywords_partner_export:          { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/search-keywords/export" },
  search_keywords_by_source:               { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/search-keywords/source/{sourceKey}" },
  search_keywords_by_source_export:        { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/search-keywords/source/{sourceKey}/export" },
  search_keywords_by_app:                  { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/products/{productId}/search-keywords" },
  search_keywords_by_app_export:           { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/products/{productId}/search-keywords/export" },
  zero_search_results_keywords:            { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/zero-search-results-keywords/source/{sourceKey}" },
  zero_search_results_keywords_export:     { method: "GET", path: "/rest/3/reporting/developer-space/{developerId}/zero-search-results-keywords/source/{sourceKey}/export" },

  // ── App listing ─────────────────────────────────────────────────────────────
  app_listing_get:    { method: "GET", path: "/rest/3/product-listing/{productId}" },
  app_listing_update: { method: "PUT", path: "/rest/3/product-listing/{productId}" },

  // ── App software ────────────────────────────────────────────────────────────
  app_software_get_by_appkey:    { method: "GET",  path: "/rest/3/app-software/app-key/{appKey}" },
  app_software_versions_list:    { method: "GET",  path: "/rest/3/app-software/{appSoftwareId}/versions" },
  app_software_version_create:   { method: "POST", path: "/rest/3/app-software/{appSoftwareId}/versions" },
  app_software_version_get:      { method: "GET",  path: "/rest/3/app-software/{appSoftwareId}/versions/{buildNumber}" },
  app_software_version_update:   { method: "PUT",  path: "/rest/3/app-software/{appSoftwareId}/versions/{buildNumber}" },
  app_software_tokens_list:      { method: "GET",  path: "/rest/3/app-software/{id}/tokens" },
  app_software_token_create:     { method: "POST", path: "/rest/3/app-software/{id}/tokens" },

  // ── App version listing ─────────────────────────────────────────────────────
  app_version_listings_list_all: { method: "GET",  path: "/rest/3/app-software/{appSoftwareId}/listings/all" },
  app_version_listing_get:       { method: "GET",  path: "/rest/3/app-software/{appSoftwareId}/versions/{buildNumber}/listing" },
  app_version_listing_create:    { method: "POST", path: "/rest/3/app-software/{appSoftwareId}/versions/{buildNumber}/listing" },
  app_version_listing_update:    { method: "PUT",  path: "/rest/3/app-software/{appSoftwareId}/versions/{buildNumber}/listing" },

  // ── Privacy & security ──────────────────────────────────────────────────────
  privacy_security_get:           { method: "GET",    path: "/rest/3/privacy-and-security/products/{productId}" },
  privacy_security_draft_put:     { method: "PUT",    path: "/rest/3/privacy-and-security/products/{productId}" },
  privacy_security_draft_delete:  { method: "DELETE", path: "/rest/3/privacy-and-security/products/{productId}" },
  privacy_security_publish:       { method: "POST",   path: "/rest/3/privacy-and-security/products/{productId}/publish" },

  // ── Cloud migration ─────────────────────────────────────────────────────────
  cloud_migration_compat_get:    { method: "GET",   path: "/rest/3/cloud-migration-compatibility/products/{productId}" },
  cloud_migration_compat_create: { method: "PUT",   path: "/rest/3/cloud-migration-compatibility/products/{productId}" },
  cloud_migration_compat_update: { method: "PATCH", path: "/rest/3/cloud-migration-compatibility/products/{productId}" },

  // ── Parent software ─────────────────────────────────────────────────────────
  parent_software_list:                  { method: "GET", path: "/rest/3/parent-software" },
  parent_software_get:                   { method: "GET", path: "/rest/3/parent-software/{parentSoftwareId}" },
  parent_software_versions_list:         { method: "GET", path: "/rest/3/parent-software/{parentSoftwareId}/versions" },
  parent_software_version_by_build:      { method: "GET", path: "/rest/3/parent-software/{parentSoftwareId}/versions/build/{buildNumber}" },
  parent_software_version_by_number:     { method: "GET", path: "/rest/3/parent-software/{id}/versions/number/{versionNumber}" },

  // ── Developer space ─────────────────────────────────────────────────────────
  developer_space_by_vendor:        { method: "GET",    path: "/rest/3/developer-space/vendor/{vendorId}" },
  developer_space_get:              { method: "GET",    path: "/rest/3/developer-space/{developerId}" },
  developer_space_catalog_account:  { method: "GET",    path: "/rest/3/developer-space/{developerId}/catalog-account" },
  developer_space_listings:         { method: "GET",    path: "/rest/3/developer-space/{developerId}/listings" },
  // The members-list endpoint's docs anchor folds query params into the slug;
  // the swagger uses the form `…/members?limit={limit}&cursor={cursor}` and
  // the docs site renders the anchor as `…-members-limit-limit-cursor-cursor-get`.
  // Our wire request still sends `?limit=&cursor=` as normal query params —
  // this `path` is only used for spec-URL generation and HTTP path building;
  // query params are stripped by buildUrl before they hit the URL builder.
  developer_space_members_list:     { method: "GET",    path: "/rest/3/developer-space/{developerId}/members?limit={limit}&cursor={cursor}" },
  developer_space_member_get:       { method: "GET",    path: "/rest/3/developer-space/{developerId}/members/{aaid}" },
  developer_space_member_add:       { method: "POST",   path: "/rest/3/developer-space/{developerId}/members/{aaid}" },
  developer_space_member_update:    { method: "PUT",    path: "/rest/3/developer-space/{developerId}/members/{aaid}" },
  developer_space_member_remove:    { method: "DELETE", path: "/rest/3/developer-space/{developerId}/members/{aaid}" },

  // ── Partner metrics / Product catalog ──────────────────────────────────────
  partner_metrics_fetch:    { method: "POST", path: "/rest/3/partner-metrics/developer-space/{developerId}" },
  product_catalog_latest:   { method: "GET",  path: "/rest/3/reporting/product-catalog/latest" },

  // ── Artifacts ───────────────────────────────────────────────────────────────
  artifact_fetch_from_url:  { method: "POST", path: "/rest/3/artifacts/fetch" },
  artifact_get:             { method: "GET",  path: "/rest/3/artifacts/{artifactId}" },
};

/**
 * Lookup helper: given a tool name, return its canonical docs URL.
 * Returns `null` for unknown tools.
 */
export function toolSpecUrl(name: string): string | null {
  const ep = TOOL_ENDPOINTS[name];
  if (!ep) return null;
  return specUrl(ep.method, ep.path);
}
