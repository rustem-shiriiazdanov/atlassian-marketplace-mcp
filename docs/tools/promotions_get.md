---
title: promotions_get
group: Tool reference — Promotions
---

# `promotions_get`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /catalog/partners/{partnerId}/promotions/{promotionId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-get)

## Description

Get one promotion by ID. Returns the full promotion object (~21 fields: id, name, eligibleApps, startDate, expirationDate, status, promotionType, discountType, discountPercent, maxUses, used, hostingType, promotionCode, …). GOTCHA: a nonexistent/malformed promotionId returns HTTP 500 (not 404).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `promotionId` | `string` | yes | UUID for Cloud, string for Server/DC |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "promotions_get",
    "arguments": {
      "promotionId": 0
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-promotionid-get)
