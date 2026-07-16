---
title: customer_insights_editions
group: Tool reference — Customer insights
---

# `customer_insights_editions`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/customer-insights/editions` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-editions-get)

## Description

App-edition distribution of your customers' users, per month. Same shape as `customer_insights_regions` but grouped by `edition` ∈ {free, standard, premium, enterprise}. Each `{date, insightsType:[{value:{group:{edition}, usersDistribution:{usersCount, usersPercent, usersMarketplaceBenchmark}}}]}`. Only startDate/endDate filter (productId/hosting/product are ignored by this endpoint).

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
    "name": "customer_insights_editions",
    "arguments": {
      "startDate": "2026-05-01"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-editions-get)
