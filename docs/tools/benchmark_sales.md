---
title: benchmark_sales
group: Tool reference — Benchmarks
---

# `benchmark_sales`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/benchmark/sales` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-benchmark-sales-get)

## Description

Sales benchmark vs. ecosystem, per month. Returns `{total:{name, salesBenchmarkPerMonth:[…]}, addons:[{addonKey, name, productId, salesBenchmarkPerMonth}]}`. Each month row: `{date, sale, previousMonthSale, salesMoMGrowth, salesPercentile, salesMoMGrowthBenchmarkAllPartners, salesYTD, salesYTDLastYear, salesYTDYoYGrowth, salesYTDPercentile, salesYTDYoYGrowthBenchmarkAllPartners}`. `*Percentile` is your rank vs all partners; `*BenchmarkAllPartners` is the ecosystem figure. Filter by addon (app key) or productId; hosting/aggregation are ignored.

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
    "name": "benchmark_sales",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-benchmark-sales-get)
