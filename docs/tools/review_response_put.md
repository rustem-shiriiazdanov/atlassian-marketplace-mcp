---
title: review_response_put
group: Tool reference — Reviews
---

# `review_response_put`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `PUT /rest/3/products/{productId}/reviews/{reviewId}/response` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-reviewid-response-put)

## Description

Post or update a vendor response to a review. PUBLIC IMPACT: response is visible to all Marketplace visitors.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `reviewId` | `string` | yes |  |
| `response` | `string` | yes | Response text body |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "review_response_put",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>",
      "reviewId": 0,
      "response": ""
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-reviewid-response-put)
