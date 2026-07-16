---
title: customer_insights_active_users
group: Tool reference — Customer insights
---

# `customer_insights_active_users`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/customer-insights/active-users` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-active-users-get)

## Description

Paid-vs-non-paid active-user distribution across the customer base, per month. Group key `activeUsers` ∈ {paid, non-paid} (2 buckets, `usersPercent` sums to ~100). Each `usersDistribution:{usersCount, usersPercent, usersMarketplaceBenchmark}`. Only startDate/endDate filter (productId/hosting/product are ignored).

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
    "name": "customer_insights_active_users",
    "arguments": {
      "startDate": "2026-05-01"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-active-users-get)
