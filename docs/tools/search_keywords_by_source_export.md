---
title: search_keywords_by_source_export
group: Tool reference — Search keywords
---

# `search_keywords_by_source_export`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/search-keywords/source/{sourceKey}/export` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-source-sourcekey-export-get)

## Description

Export variant of source-filtered search keywords. UNLIKE the partner/by_app exports, this returns the FULL DATA directly as a JSON array of `{searchKeyword, percentage}` rows (up to 500), NOT HAL download links. Large responses spill to the truncation envelope.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `sourceKey` | enum: `marketplace` \| `embedded-marketplace` | yes | Search source. Allowable: `marketplace` (public marketplace.atlassian.com search) or `embedded-marketplace` (in-product 'find apps' search). Invalid → HTTP 400. |
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
    "name": "search_keywords_by_source_export",
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
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-source-sourcekey-export-get)
