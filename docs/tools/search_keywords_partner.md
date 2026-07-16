---
title: search_keywords_partner
group: Tool reference — Search keywords
---

# `search_keywords_partner`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/search-keywords` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-get)

## Description

Top search keywords across all the partner's apps (developer-space wide). Returns `{total:{searchAppearances, topSearchKeyword}, addons:[{addonName, addonKey, productId, leadingSearchKeyword, searchAppearances, elements:[{date,count}]}]}`. Filters: aggregation/startDate/endDate only (pagination/productId/hosting are ignored — it's an aggregate).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
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
    "name": "search_keywords_partner",
    "arguments": {
      "aggregation": "week"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-get)
