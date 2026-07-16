---
title: promotions_update
group: Tool reference — Promotions
---

# `promotions_update`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `PATCH /catalog/partners/{partnerId}/promotions/{promotionId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-patch)

## Description

Update a promotion (PATCH — only supplied fields change).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `promotionId` | `string` | yes |  |
| `name` | `string` | no |  |
| `startDate` | `string` | no |  |
| `expirationDate` | `string` | no |  |
| `discountPercent` | `integer` | no |  |
| `maxUses` | `integer` | no |  |
| `allowedBillingCycles` | `integer` | no |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "promotions_update",
    "arguments": {
      "promotionId": 0,
      "name": ""
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-patch)
