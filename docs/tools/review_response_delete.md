---
title: review_response_delete
group: Tool reference — Reviews
---

# `review_response_delete`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `DELETE /rest/3/products/{productId}/reviews/{reviewId}/response` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-reviewid-response-delete)

## Description

Delete the vendor's response to a review. PUBLIC IMPACT: removes a publicly visible response.

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
    "name": "review_response_delete",
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
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-reviewid-response-delete)
