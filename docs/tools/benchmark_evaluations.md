---
title: benchmark_evaluations
group: Tool reference — Benchmarks
---

# `benchmark_evaluations`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/benchmark/evaluations` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-benchmark-evaluations-get)

## Description

Evaluations benchmark vs. ecosystem, per month. Returns `{totals:{name, evaluationBenchmarkPerVendorPerMonth:[…]}, addons:[{addonKey, name, productId, evaluationBenchmarkPerAppPerMonth}]}`. NOTE the wrapper is `totals` (plural) and the per-month key differs between total level (`…PerVendorPerMonth`) and addon level (`…PerAppPerMonth`). Each month row: `{date, evaluationCount, previousMonthEvaluationCount, evaluationMoMGrowth, evaluationPercentile, evaluationMoMGrowthBenchmarkAllPartners, evaluationCountYTD, evaluationCountYTDLastYear, evaluationYTDYoYGrowth, evaluationYTDPercentile, evaluationYTDYoYGrowthBenchmarkAllPartners}`. Filter by addon/productId; hosting/aggregation ignored.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID. Narrows to one app. (Not in the HAL template but works.) |
| `addon` | `string` | no | App key (e.g. `com.example.your-app`). Narrows to one app. Alternative to `productId`. |
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
    "name": "benchmark_evaluations",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-benchmark-evaluations-get)
