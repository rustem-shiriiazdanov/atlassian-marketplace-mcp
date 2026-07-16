---
title: search_keywords_by_source
group: Tool reference — Search keywords
---

# `search_keywords_by_source`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/search-keywords/source/{sourceKey}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-source-sourcekey-get)

## Description

Top search keywords for one source. Returns `{details:[{searchKeyword, percentage}]}` (flat keyword share, no time series). Filters: startDate/endDate (no aggregation; pagination ignored).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `sourceKey` | enum: `marketplace` \| `embedded-marketplace` | yes | Search source. Allowable: `marketplace` (public marketplace.atlassian.com search) or `embedded-marketplace` (in-product 'find apps' search). Invalid → HTTP 400. |
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
    "name": "search_keywords_by_source",
    "arguments": {
      "sourceKey": "marketplace",
      "startDate": "2026-05-01"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-source-sourcekey-get)
