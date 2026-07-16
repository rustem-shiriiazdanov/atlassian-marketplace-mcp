---
title: search_keywords_by_app
group: Tool reference — Search keywords
---

# `search_keywords_by_app`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/products/{productId}/search-keywords` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-products-productid-search-keywords-get)

## Description

Top search keywords for one app. Returns `{summary:{addonName, addonKey, leadingSearchKeyword, …}, details:[{searchKeyword, keywordCount, elements:[{date,count}]}]}`. `productId` is a PATH segment. Filters: aggregation/startDate/endDate (pagination/hosting ignored).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes | Product UUID (path segment; from apps_list / apps_known). |
| `aggregation` | enum: `week` \| `month` | no | Time-series bucket cadence for the `elements[]` arrays. Default week. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_keywords_by_app",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>",
      "aggregation": "week"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-products-productid-search-keywords-get)
