---
title: transactions_aggregate_by_hosting
group: Tool reference — Transactions
---

# `transactions_aggregate_by_hosting`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/transactions/{metric}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-metric-get)

> **Note:** Friendly alias of transactions_aggregate_by_metric(metric='hosting')

## Description

Friendly alias for transactions_aggregate_by_metric(metric='hosting'). HAL template `hosting{?aggregation,startDate,endDate}`. NOTE: `productId` is silently ignored on this specific endpoint (verified 2026-06-03) — use `transactions_aggregate_by_metric` with `metric=hosting` if you need productId scoping.

📖 Spec (GET /rest/3/reporting/developer-space/{developerId}/sales/transactions/{metric} — Friendly alias of transactions_aggregate_by_metric(metric='hosting')): https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-metric-get

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `aggregation` | enum: `month` \| `week` | no | Time bucket granularity for the series — month or week. |
| `startDate` | `string` | no |  |
| `endDate` | `string` | no |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "transactions_aggregate_by_hosting",
    "arguments": {
      "aggregation": "month"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-metric-get)
