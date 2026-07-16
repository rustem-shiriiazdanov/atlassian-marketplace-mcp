---
title: metrics_churn_benchmark
group: Tool reference — Sales metrics
---

# `metrics_churn_benchmark`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/metrics/churn/benchmark` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-churn-benchmark-get)

## Description

Per-app monthly churn benchmark vs. ecosystem average. Returns `churnBenchmarkPerApp[]` where each entry has `churnBenchmarkPerMonth[]` rows: `{year, month, churnedLicenses, totalLicenses, churnRate, isolatedChurnRate, churnRateBenchmark, isolatedChurnRateBenchmark}`. The `*Benchmark` fields are normalized so 1.0 ≈ ecosystem average. Filter by `addon` (app key) or `productId` (UUID). Note: data has a ~2-3 month publication lag. Default (no filter) returns full history for all apps — large response (~60KB) triggers the truncation envelope. Use date range to narrow.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `addon` | `string` | no | App key (e.g. `com.example.your-app` — NOT productId UUID). Single value via this MCP. Silently ignored if `productId` is also passed. |
| `productId` | `string` | no | Product UUID. Single value. Not documented in Atlassian's HAL query template but works as a real filter. When BOTH `addon` and `productId` are passed, `productId` wins. Invalid or non-matching UUIDs are silently ignored (full list returned). |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. Trims `churnBenchmarkPerMonth[]` to months overlapping the window. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. Note: data has a ~2-3 month publication lag; very recent windows can return empty `churnBenchmarkPerApp[]`. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "metrics_churn_benchmark",
    "arguments": {
      "addon": ""
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-metrics-churn-benchmark-get)
