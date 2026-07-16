---
title: promotions_codes_create
group: Tool reference — Promotions
---

# `promotions_codes_create`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `POST /catalog/partners/{partnerId}/promotions/{promotionId}/codes` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-post)

## Description

Generate a new single-use code for a promotion.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `promotionId` | `string` | yes |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "promotions_codes_create",
    "arguments": {
      "promotionId": 0
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-post)
