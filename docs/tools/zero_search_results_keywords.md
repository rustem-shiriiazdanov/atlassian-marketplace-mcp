---
title: zero_search_results_keywords
group: Tool reference — Search keywords — zero results
---

# `zero_search_results_keywords`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/zero-search-results-keywords/source/{sourceKey}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-zero-search-results-keywords-source-sourcekey-get)

## Description

Keywords that produced ZERO search results, for one source — SEO gap analysis. Returns `{details:[{searchKeyword, count}]}` (count = how many times the no-result search happened). Filters: startDate/endDate (no aggregation; pagination ignored).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `sourceKey` | enum: `marketplace` | yes | Search source. ONLY `marketplace` is supported for zero-result keywords (unlike the other search-keyword tools, `embedded-marketplace` is rejected with HTTP 400). |
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
    "name": "zero_search_results_keywords",
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
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-zero-search-results-keywords-source-sourcekey-get)
