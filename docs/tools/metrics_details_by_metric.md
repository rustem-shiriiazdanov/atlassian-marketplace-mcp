---
title: metrics_details_by_metric
group: Tool reference — Sales metrics
---

# `metrics_details_by_metric`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/metrics/{saleMetric}/details` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-salemetric-details-get)

## Description

License-event details underlying a sale metric. Returns `events[]` rows: `{addonKey, addonName, hosting, lastUpdated, eventDate, transactionId, licenseDetails, productId}`. Supports rich filters (addon, hosting, partnerType, text, sortBy, order, offset, limit). Server caps limit at 50.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `saleMetric` | enum: `churn` \| `conversion` \| `renewal` | yes | Which underlying metric's events to fetch. |
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
| `offset` | `integer` | no |  |
| `limit` | `integer` | no | Max 50 (server hard-cap; values above are clamped to 50). |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "metrics_details_by_metric",
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
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-salemetric-details-get)
