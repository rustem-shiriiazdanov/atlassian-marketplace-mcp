---
title: promotions_code_delete
group: Tool reference — Promotions
---

# `promotions_code_delete`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `DELETE /catalog/partners/{partnerId}/promotions/{promotionId}/codes/{promotionCode}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-promotioncode-delete)

## Description

Delete an unused single-use code.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `promotionId` | `string` | yes |  |
| `promotionCode` | `string` | yes | Promotion code identifier (string like 'VN5U6M') |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "promotions_code_delete",
    "arguments": {
      "promotionId": 0,
      "promotionCode": "VN5U6M"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-promotioncode-delete)
