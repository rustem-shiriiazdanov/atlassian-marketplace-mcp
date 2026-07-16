---
title: promotions_codes_list
group: Tool reference — Promotions
---

# `promotions_codes_list`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /catalog/partners/{partnerId}/promotions/{promotionId}/codes` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-get)

## Description

List single-use codes for a SINGLE_USE_PROMOTION.

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
    "name": "promotions_codes_list",
    "arguments": {
      "promotionId": 0
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-codes-get)
