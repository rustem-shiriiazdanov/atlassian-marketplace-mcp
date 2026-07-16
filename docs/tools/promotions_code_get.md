---
title: promotions_code_get
group: Tool reference — Promotions
---

# `promotions_code_get`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /catalog/partners/{partnerId}/promotions/{promotionId}/codes/{promotionCode}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-promotioncode-get)

## Description

Get one single-use code (including usage info if redeemed).

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
    "name": "promotions_code_get",
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
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-promotioncode-get)
