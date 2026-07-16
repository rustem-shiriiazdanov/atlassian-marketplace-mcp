---
title: zero_search_results_keywords_export
group: Tool reference — Search keywords — zero results
---

# `zero_search_results_keywords_export`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/zero-search-results-keywords/source/{sourceKey}/export` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-zero-search-results-keywords-source-sourcekey-export-get)

## Description

Export variant of zero-result keywords. Returns the FULL DATA directly as a JSON array of `{searchKeyword, count}` rows (up to 500), NOT HAL download links (same as the by_source export). Large responses spill to the truncation envelope.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `sourceKey` | enum: `marketplace` | yes | Search source. ONLY `marketplace` is supported for zero-result keywords (unlike the other search-keyword tools, `embedded-marketplace` is rejected with HTTP 400). |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |
| `accept` | enum: `csv` \| `json` | no | Output format: `json` (default) or `csv` (returns a CSV string with a header row). Invalid → HTTP 400. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "zero_search_results_keywords_export",
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
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-zero-search-results-keywords-source-sourcekey-export-get)
