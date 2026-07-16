---
title: customer_insights_regions
group: Tool reference — Customer insights
---

# `customer_insights_regions`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/customer-insights/regions` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-regions-get)

## Description

Geographic-region distribution of your customers' users, per month. Returns `usersDistributionPerMonth[]`: each `{date, insightsType:[{value:{group:{region}, usersDistribution:{usersCount, usersPercent, usersMarketplaceBenchmark}}}]}`. Regions seen: apac, emea, americas, unknown. `usersPercent` sums to ~100 per month; `usersMarketplaceBenchmark` is the ecosystem comparison. Only startDate/endDate filter (productId/hosting are ignored by this endpoint).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `startDate` | `string` | no | ISO date YYYY-MM-DD. Filters the monthly distribution buckets. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "customer_insights_regions",
    "arguments": {
      "startDate": "2026-05-01"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-regions-get)
