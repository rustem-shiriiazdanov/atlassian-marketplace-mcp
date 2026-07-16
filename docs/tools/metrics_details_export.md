---
title: metrics_details_export
group: Tool reference — Sales metrics
---

# `metrics_details_export`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/metrics/{saleMetric}/details/export` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-salemetric-details-export-get)

## Description

Export of license-event details for a sale metric. `accept=csv` (default) returns the 17-column CSV (`addonName,addonKey,hosting,lastUpdated,eventDate,transactionId,licenseId,maintenanceStartDate,maintenanceEndDate,monthsValid,appEntitlementId,appEntitlementNumber,cloudId,inGracePeriod,multiInstanceEntitlementId,multiInstanceEntitlementNumber,appEdition`); `accept=json` returns a JSON array. Same filters as `metrics_details_by_metric` EXCEPT no `offset`/`limit` (full dump). 10-minute timeout (override via EXPORT_TIMEOUT_MS). Large exports spill to a tmp file via the truncation envelope.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `saleMetric` | enum: `churn` \| `conversion` \| `renewal` | yes | Which underlying metric's events to export. |
| `productId` | `string` | no | Product UUID — narrows events to one app (documented + verified 2026-06-03; all returned rows match). |
| `appEdition` | enum: `free` \| `standard` \| `advanced` | no | Filter by app edition (free/standard/advanced). |
| `addon` | `string` | no | App key (e.g. `com.example.your-app`). Undocumented but works as an app filter. Prefer `productId`. |
| `hosting` | enum: `cloud` \| `datacenter` \| `server` | no | Filter events by hosting. Response objects use capitalized 'Cloud'/'Server'/'Data Center'. |
| `partnerType` | enum: `direct` \| `expert` \| `reseller` | no | Filter by partner attribution channel: `direct`, `expert`, `reseller`. NOTE: Atlassian's error message also lists `upgrade` as allowable, but passing it returns HTTP 400 (Atlassian-side contradiction, verified 2026-06-03) — so it's excluded here. |
| `text` | `string` | no | Free-text search across event identifiers (SEN / appEntitlementNumber, transactionId, customer email, etc). Verified to narrow correctly. |
| `lastUpdated` | `string` | no | ISO date YYYY-MM-DD — events whose lastUpdated is on/after this date. Verified to narrow correctly. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD (filters by eventDate). |
| `endDate` | `string` | no | ISO date YYYY-MM-DD (filters by eventDate). |
| `sortBy` | enum: `addonName` \| `date` \| `hosting` \| `transactionId` \| `licenseId` | no | Sort field. Allowed per Atlassian: `addonName`, `date`, `hosting`, `transactionId`, `licenseId`. Anything else → HTTP 400. Only meaningful combined with `order=asc` (see `order`). |
| `order` | enum: `asc` \| `desc` | no | Sort direction. **`asc` works; `desc` is unreliable on this endpoint** — Atlassian returns a non-monotonic ordering for `order=desc` (verified 2026-06-03). With no `sortBy`, `order` is ignored entirely. Prefer `sortBy=date&order=asc` and reverse client-side if you need descending. |
| `accept` | enum: `csv` \| `json` | no | Output format: `csv` (default for these exports — header-rowed CSV string) or `json` (array of records). Invalid → HTTP 400. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "metrics_details_export",
    "arguments": {
      "saleMetric": "churn",
      "productId": "<product-uuid-from-apps_list>"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-salemetric-details-export-get)
