---
title: search_keywords_partner_export
group: Tool reference — Search keywords
---

# `search_keywords_partner_export`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/search-keywords/export` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-export-get)

## Description

Export variant of partner-wide search keywords. With `accept=json` (default) returns the data INLINE as `{_links:{self,query,export}, total, addons}` (same payload as `search_keywords_partner`); with `accept=csv` returns a per-app CSV string. ⚠️ The advertised `_links.export` download URLs are BROKEN (Atlassian-side doubled `/export/export` path → 404, verified 2026-06-03) — use the inline data or `accept=csv` instead. Filters: aggregation/startDate/endDate.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `aggregation` | enum: `week` \| `month` | no | Time-series bucket cadence for the `elements[]` arrays. Default week. |
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
    "name": "search_keywords_partner_export",
    "arguments": {
      "aggregation": "week"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-search-keywords-export-get)
