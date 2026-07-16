---
title: metrics_renewal
group: Tool reference — Sales metrics
---

# `metrics_renewal`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/metrics/renewal` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-renewal-get)

## Description

Cloud renewal TIME-SERIES. `total.datasets[]` split by billing period (`Annual`, `Monthly`) — like churn — with two series each: `Renewal opportunities` (denominator) and `Renewals` (numerator). NOTE: unlike churn, renewal series have NO `uniqueTotal` field (each series is just `{name, elements:[{date,count}]}`). `addons[]` carry `datasets`. Caller computes renewal rate = Renewals / Renewal opportunities per bucket. Only aggregation/startDate/endDate work; other filters silently ignored. Reversed/future ranges return empty datasets+addons.

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
    "name": "metrics_renewal",
    "arguments": {
      "aggregation": "week"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-renewal-get)
