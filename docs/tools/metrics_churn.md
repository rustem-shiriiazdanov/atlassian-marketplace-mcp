---
title: metrics_churn
group: Tool reference — Sales metrics
---

# `metrics_churn`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/metrics/churn` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-churn-get)

## Description

Cloud churn TIME-SERIES (not a single rate). Returns `total.datasets` split by billing period (`Monthly`, `Annual`) with two series each: `Customers` (cohort denominator) and `Cancellations` (numerator), plus per-app breakdown in `addons[]`. Caller computes rate = Cancellations / Customers per bucket. Only 3 filters work (aggregation/startDate/endDate); productId/hosting/addon are silently ignored on this aggregate endpoint.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `aggregation` | enum: `week` \| `month` | no | Time-series bucket cadence. Default: week. Affects the number of `elements[]` returned per series. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD (inclusive lower bound). |
| `endDate` | `string` | no | ISO date YYYY-MM-DD (inclusive upper bound). |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "metrics_churn",
    "arguments": {
      "aggregation": "week"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-churn-get)
