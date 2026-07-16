---
title: apps_list
group: Tool reference — Apps discovery
---

# `apps_list`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/product-listing/developer-space/{developerId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-developer-space-developerid-get)

## Description

Discover apps in this developer space (live API call). Returns productId (UUID — use as filter), appKey, appName, state. CURSOR-paginated: pass `cursor` (from a prior response's `nextCursor`) to page forward. In summary mode the result includes `nextCursor` (null when no more pages). Default (no `limit`) returns up to 10 (the API's default page size).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `includeFullPayload` | `boolean` | no | If true, return the raw API response ({items, links}). Default false returns a compact summary + nextCursor. |
| `limit` | `integer` | no | Page size. Omit for the API default (10). Cursor pagination — `offset` is not supported. |
| `cursor` | `string` | no | Opaque pagination token from a prior response's `nextCursor` (summary mode) or `links.next` (full mode). |
| `includePrivate` | `boolean` | no | Include private (unlisted) apps in addition to public ones. Invalid value → HTTP 400. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "apps_list",
    "arguments": {
      "includeFullPayload": false
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-developer-space-developerid-get)
