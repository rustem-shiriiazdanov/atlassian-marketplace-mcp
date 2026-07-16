---
title: review_get
group: Tool reference — Reviews
---

# `review_get`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/products/{productId}/reviews/{reviewId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-reviewid-get)

## Description

Get a single review by ID.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `reviewId` | `string` | yes |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "review_get",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>",
      "reviewId": 0
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-reviewid-get)
