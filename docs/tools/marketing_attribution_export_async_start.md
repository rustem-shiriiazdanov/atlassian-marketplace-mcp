---
title: marketing_attribution_export_async_start
group: Tool reference — Marketing attribution
---

# `marketing_attribution_export_async_start`

🔧 **write-safe** — writes (e.g. enqueues an async job or creates a vendor-internal record), no public-facing effect.

**📖 Spec:** `POST /rest/3/reporting/developer-space/{developerId}/marketing-attribution/async/export` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-marketing-attribution-async-export-post)

## Description

Start an async export of marketing-attribution data. Returns `{export:{id}}` — pass that id to `marketing_attribution_export_async_status` then `_download`. Filters: productId/addon/text/startDate/endDate (+ `accept` for the eventual download format). Export is param-deduped: identical params yield the same exportId.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID to scope the export to one app (verified: changes the exportId, so it affects the data). |
| `addon` | `string` | no | App key (e.g. `com.example.your-app`) to scope the export to one app. |
| `text` | `string` | no | Free-text search filter applied to the exported attribution rows. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |
| `accept` | enum: `csv` \| `json` | no | Format the eventual download produces (`csv`\|`json`). The start response itself is always the `{export:{id}}` envelope. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "marketing_attribution_export_async_start",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-marketing-attribution-async-export-post)
