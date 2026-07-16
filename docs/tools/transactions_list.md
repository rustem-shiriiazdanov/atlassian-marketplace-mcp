---
title: transactions_list
group: Tool reference — Transactions
---

# `transactions_list`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/transactions` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-get)

## Description

List sales transactions for this vendor's apps (refunds appear inline as negative amounts). NOTE per Atlassian: this endpoint can return 5xx on large datasets — for full pulls, prefer transactions_export_async_start + status + download. Use 'text' to find by transactionId, licenseId, SEN, customer info, or partner info.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID (or comma-separated list). Use apps_list / apps_known to discover. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD |
| `endDate` | `string` | no | ISO date YYYY-MM-DD |
| `hosting` | enum: `cloud` \| `datacenter` \| `server` | no | Note: 'datacenter' is one word, not 'data_center'. Response objects use capitalized 'Cloud'/'Server'/'Data Center' but the filter param is lowercase one-word. |
| `offset` | `integer` | no |  |
| `limit` | `integer` | no |  |
| `sortBy` | enum: `addonName` \| `company` \| `country` \| `date` \| `hosting` \| `licenseId` \| `licenseType` \| `partner` \| `partnerType` \| `purchasePrice` \| `region` \| `saleType` \| `tier` \| `transactionId` \| `vendorAmount` \| `paymentStatus` | no |  |
| `order` | enum: `asc` \| `desc` | no |  |
| `text` | `string` | no | Free-text search across identifiers: transactionId, licenseId, SEN, appEntitlementNumber, customer info, partner info. |
| `tier` | `integer` | no |  |
| `saleType` | enum: `new` \| `refund` \| `downgrade` \| `renewal` \| `upgrade` | no |  |
| `partnerType` | enum: `direct` \| `expert` \| `reseller` \| `upgrade` | no |  |
| `billingPeriod` | enum: `monthly` \| `annual` | no | Filter by billing period. Not documented in swagger but accepted by the live API. |
| `lastUpdated` | `string` | no | ISO date/datetime — returns transactions updated ON OR AFTER this date (inclusive lower bound). |
| `excludeZeroTransactions` | `boolean` | no | If true, omits $0 transactions (e.g. Cloud Free tier). |
| `includeManualInvoice` | `boolean` | no | If true, includes manually-invoiced transactions in the response. |
| `paymentStatus` | enum: `paid` \| `refunded` \| `uncollectible` \| `open` | no |  |
| `cloudComplianceBoundaries` | enum: `commercial` \| `fedramp_moderate` \| `isolated_cloud` | no | Cloud compliance boundary on the underlying license. Valid: 'commercial' (default), 'fedramp_moderate', 'isolated_cloud'. **Cloud-hosted apps only — ignored for server/datacenter.** Single value here; for multiple, make separate calls. |
| `appEdition` | enum: `free` \| `standard` \| `advanced` | no | Filter by app edition (free / standard / advanced). |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "transactions_list",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-get)
