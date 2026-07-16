---
title: app_listing_update
group: Tool reference — App listing
---

# `app_listing_update`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `PUT /rest/3/product-listing/{productId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-productid-put)

## Description

Update Marketplace product listing metadata. PUBLIC IMPACT: changes appear on the app's marketplace page after approval. PUT semantics — body should be a full listing object.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `body` | `object` | yes | Full listing payload (matches the GET response shape) |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "app_listing_update",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>",
      "body": {}
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-productid-put)
