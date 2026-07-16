---
title: reviews_list
group: Tool reference — Reviews
---

# `reviews_list`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/products/{productId}/reviews` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-get)

## Description

List customer reviews for an app. CURSOR-paginated (not offset). Returns `{productId, reviews:[{id, content, stars, date, totalVotes, helpfulVotes, productHosting, isFlagged, authorName, transitionedToFiveStarRating}], cursor, count, averageStars}` where `count` is the total review count, `averageStars` the overall rating, and `cursor` the token for the next page. Pass `cursor` back to page forward. NOTE: reviews contain author names + free-text (PII).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes | Product UUID (from apps_list / apps_known). |
| `hosting` | enum: `cloud` \| `server` \| `datacenter` | no | Filter reviews by the reviewer's hosting platform. Narrows by each row's `productHosting`. Invalid value → HTTP 400. |
| `sort` | enum: `recent` \| `helpful` \| `highest_rated` \| `lowest_rated` | no | Sort order. `recent` (newest first), `helpful` (most helpful votes), `highest_rated`/`lowest_rated` (by stars). Invalid → HTTP 400. (The param is `sort` with these enum values — NOT `sortBy`/`order`, which are ignored.) |
| `limit` | `integer` | no | Page size (caps the `reviews[]` array). |
| `cursor` | `string` | no | Opaque pagination token from a previous response's `cursor`. This endpoint is cursor-based — `offset` is NOT supported (silently ignored). |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "reviews_list",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>",
      "hosting": "cloud"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reviews/#api-rest-3-products-productid-reviews-get)
