---
title: metrics_conversion
group: Tool reference — Sales metrics
---

# `metrics_conversion`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/metrics/conversion` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-conversion-get)

## Description

Cloud evaluation→paid conversion TIME-SERIES. Shape differs from churn/renewal: `total.series[]` is FLAT (no `datasets[]` billing-period split) with two series — `Evaluations` (denominator) and `Conversions` (numerator) — each a list of `{date, count}` elements. No `uniqueTotal` field. `addons[]` carry `series` directly. Caller computes conversion rate = Conversions / Evaluations per bucket. Only aggregation/startDate/endDate work; other filters silently ignored. Reversed or future-only ranges return empty `series`/`addons`.

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
    "name": "metrics_conversion",
    "arguments": {
      "aggregation": "week"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-conversion-get)
