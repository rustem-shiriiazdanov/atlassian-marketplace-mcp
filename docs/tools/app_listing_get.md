---
title: app_listing_get
group: Tool reference — App listing
---

# `app_listing_get`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/product-listing/{productId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-productid-get)

## Description

Get Marketplace product listing metadata for one app. Returns `{productId, appKey, developerId, appName, summary, tagLine, images, tags, communityEnabled, developerLinks, thirdPartyIntegrations, state, approvalStatus, approvalDetails, slug, cloudComplianceBoundary, hostingVisibility, marketingLabels, revision, …}`. Unknown productId → HTTP 404.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes | Product UUID |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "app_listing_get",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-productid-get)
