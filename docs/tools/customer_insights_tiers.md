---
title: customer_insights_tiers
group: Tool reference — Customer insights
---

# `customer_insights_tiers`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/customer-insights/tiers` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-tiers-get)

## Description

User-tier distribution of your customers, per month, split by HOST PRODUCT. Group has TWO keys: `{product, tier}` where `product` is the host app (Jira/Confluence/…) and `tier` ∈ {Evaluation, 1-10, 11-100, 101-1000, 1000+}. Each `usersDistribution:{usersCount, usersPercent, usersMarketplaceBenchmark}`. `usersPercent` sums to ~100% PER host product (so ~200% across two products). Filter to one host with `product=Jira` (NAME, case-insensitive — not a UUID). startDate/endDate also filter; productId/hosting are ignored.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |
| `product` | `string` | no | Host application NAME — `jira` or `confluence` (case-insensitive). NOT a productId UUID or app key — anything else returns HTTP 400 'Must be a jira or confluence'. Omit to get all host products. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "customer_insights_tiers",
    "arguments": {
      "startDate": "2026-05-01"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-customer-insights-tiers-get)
