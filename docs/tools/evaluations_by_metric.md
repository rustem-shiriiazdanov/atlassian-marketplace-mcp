---
title: evaluations_by_metric
group: Tool reference — Evaluations
---

# `evaluations_by_metric`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/evaluations/{metric}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-evaluations-metric-get)

## Description

Evaluation time-series grouped by a dimension. FLAT `total.series[]` (no datasets, no uniqueTotal) — one series per group value (e.g. country names for `metric=country`), each `{name, elements:[{date,count}]}` — plus per-app `addons[]`. Only aggregation/startDate/endDate filter (productId/hosting/addon are silently ignored on this endpoint).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `metric` | enum: `country` \| `hosting` \| `partner` \| `region` | yes | Path segment / grouping dimension. Allowable per Atlassian: `country`, `hosting`, `partner`, `region`. Anything else → HTTP 400. |
| `aggregation` | enum: `week` \| `month` | no | Time-series bucket cadence. Default week. Invalid → 400. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "evaluations_by_metric",
    "arguments": {
      "metric": "country",
      "aggregation": "week"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-evaluations-metric-get)
