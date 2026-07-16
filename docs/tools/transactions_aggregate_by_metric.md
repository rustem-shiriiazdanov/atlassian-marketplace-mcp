---
title: transactions_aggregate_by_metric
group: Tool reference — Transactions
---

# `transactions_aggregate_by_metric`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/transactions/{metric}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-metric-get)

## Description

Aggregated sales grouped by a metric path segment. Maps to /sales/transactions/{metric}.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `metric` | enum: `country` \| `hosting` \| `partner` \| `region` \| `tier` \| `type` | yes | Allowable values per Atlassian: country, hosting, partner, region, tier, type |
| `aggregation` | enum: `month` \| `week` | no | Time bucket granularity for the series — month or week. |
| `productId` | `string` | no | Optional product UUID. Not documented in swagger but accepted by the live API and applied. |
| `startDate` | `string` | no |  |
| `endDate` | `string` | no |  |
| `hosting` | enum: `cloud` \| `datacenter` \| `server` | no |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "transactions_aggregate_by_metric",
    "arguments": {
      "metric": "country",
      "aggregation": "month"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-metric-get)
