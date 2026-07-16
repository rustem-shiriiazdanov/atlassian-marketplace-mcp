---
title: promotions_create
group: Tool reference — Promotions
---

# `promotions_create`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `POST /catalog/partners/{partnerId}/promotions` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-post)

## Description

Create a new promotion. PUBLIC IMPACT: promo code becomes redeemable by customers. Required: name, eligibleApps, expirationDate, hostingType, promotionType, discountType.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | yes |  |
| `eligibleApps` | `array` | yes | App keys this promotion applies to |
| `startDate` | `string` | no | ISO datetime (YYYY-MM-DDTHH:mm:ssZ). Plain YYYY-MM-DD is auto-padded with T00:00:00Z by this tool. |
| `expirationDate` | `string` | yes | ISO datetime (YYYY-MM-DDTHH:mm:ssZ). Plain YYYY-MM-DD is auto-padded with T00:00:00Z by this tool. |
| `promotionType` | enum: `SHARED_PROMOTION` \| `SINGLE_USE_PROMOTION` | yes |  |
| `discountType` | `string` | yes |  |
| `discountPercent` | `integer` | no |  |
| `maxUses` | `integer` | no | Required for shared promotions unless allowUnlimitedUses=true |
| `hostingType` | enum: `SERVER` \| `DATA_CENTER` \| `CLOUD` | yes |  |
| `subscriptionType` | enum: `MONTHLY` \| `ANNUAL` | no | Cloud only |
| `allowedBillingCycles` | `integer` | no | Cloud only |
| `allowUnlimitedUses` | `boolean` | no |  |
| `customPromoCode` | `string` | no | Cloud only; will be prefixed with autogen string for shared promos |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "promotions_create",
    "arguments": {
      "name": "",
      "eligibleApps": [],
      "expirationDate": "2026-05-01",
      "promotionType": "SHARED_PROMOTION",
      "discountType": "",
      "hostingType": "SERVER"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-post)
