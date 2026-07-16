---
title: licenses_export_sync
group: Tool reference — Licenses
---

# `licenses_export_sync`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/licenses/export` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-licenses-export-get)

## Description

Synchronous export of licenses. `accept=csv` (default) returns a CSV string; `accept=json` returns a JSON array. May 5xx on large ranges — prefer the async variant. Request timeout is bumped to 10 min (overridable via EXPORT_TIMEOUT_MS env).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID (or comma-separated list). Use apps_list / apps_known to discover. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD |
| `endDate` | `string` | no | ISO date YYYY-MM-DD |
| `hosting` | enum: `cloud` \| `datacenter` \| `server` | no | Note: 'datacenter' is one word, not 'data_center'. Response objects use capitalized 'Cloud'/'Server'/'Data Center' but the filter param is lowercase one-word. |
| `offset` | `integer` | no |  |
| `limit` | `integer` | no |  |
| `sortBy` | enum: `addonName` \| `company` \| `country` \| `endDate` \| `hosting` \| `licenseId` \| `licenseType` \| `partner` \| `region` \| `startDate` \| `tier` | no |  |
| `order` | enum: `asc` \| `desc` | no |  |
| `text` | `string` | no | Free-text search across identifiers: SEN, appEntitlementNumber (Cloud), appEntitlementId (UUID), cloudId, cloudSiteHostname, email, organization name. |
| `tier` | `integer` | no |  |
| `dateType` | enum: `start` \| `end` | no |  |
| `licenseType` | enum: `academic` \| `commercial` \| `demonstration` \| `evaluation` \| `net_new_evaluation` \| `upgrade_evaluation` \| `open_source` \| `starter` \| `free` \| `classroom` \| `legacy_free` | no |  |
| `licenseLevel` | enum: `single-instance` \| `multi-instance` | no |  |
| `partnerType` | enum: `direct` \| `expert` \| `reseller` \| `upgrade` | no |  |
| `status` | enum: `active` \| `inactive` \| `cancelled` | no |  |
| `withAttribution` | `boolean` | no | DEPRECATED by Atlassian; use withDataInsights instead. Both add evaluation/attribution fields when true. |
| `withDataInsights` | `boolean` | no | Adds 10 extra fields to each license: evaluationOpportunitySize, evaluationLicense, daysToConvertEval, evaluationStartDate, evaluationEndDate, evaluationSaleDate, parentProductBillingCycle, parentProductName, installedOnSandbox, parentProductEdition. |
| `includeAtlassianLicenses` | `boolean` | no | If true, include internal Atlassian licenses in the result. |
| `showLicensesHistory` | `boolean` | no | If true, returns the full history of license events for matched SENs (multiple rows per license). Not formally in the swagger but the runtime API accepts it. |
| `showLifeTimeFreeLicenses` | `boolean` | no | If true, scope the response to lifetime-free-tier licenses. If false (default), excludes them. |
| `cloudComplianceBoundaries` | enum: `commercial` \| `fedramp_moderate` \| `isolated_cloud` | no | Cloud compliance boundary. Valid values: 'commercial' (default), 'fedramp_moderate', 'isolated_cloud'. **Cloud-hosted apps only — silently ignored for server/datacenter apps.** Defaults to 'commercial' when omitted on cloud apps. NOTE: This MCP currently accepts a single value; to query multiple boundaries make separate calls (probed 2026-06-01: comma-separated lists are silently mis-parsed by the API — only repeated-param form works server-side). |
| `appEdition` | enum: `free` \| `standard` \| `advanced` | no | Filter by app edition (case-insensitive in practice but lowercase per Atlassian's error spec). |
| `lastUpdated` | `string` | no | ISO datetime — licenses updated on/after this instant. |
| `accept` | enum: `csv` \| `json` | no | Output format: `csv` (default for these exports — header-rowed CSV string) or `json` (array of records). Invalid → HTTP 400. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "licenses_export_sync",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-licenses-export-get)
