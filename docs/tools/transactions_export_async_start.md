---
title: transactions_export_async_start
group: Tool reference — Transactions
---

# `transactions_export_async_start`

🔧 **write-safe** — writes (e.g. enqueues an async job or creates a vendor-internal record), no public-facing effect.

**📖 Spec:** `POST /rest/3/reporting/developer-space/{developerId}/sales/transactions/async/export` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-async-export-post)

## Description

Start an async transactions export job. Returns `{export:{id}}` to poll. `accept=csv|json` sets the eventual download format (start response is always the id envelope).

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
| `accept` | enum: `csv` \| `json` | no | Output format: `csv` (default for these exports — header-rowed CSV string) or `json` (array of records). Invalid → HTTP 400. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "transactions_export_async_start",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-async-export-post)
