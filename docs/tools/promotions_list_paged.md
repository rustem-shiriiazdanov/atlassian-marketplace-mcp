---
title: promotions_list_paged
group: Tool reference — Promotions
---

# `promotions_list_paged`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /catalog/partners/{partnerId}/promotions/paged` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-paged-get)

## Description

List promotions (paginated). STRONGLY prefer this over promotions_list (the non-paged variant can time out). Returns `{_links, promotions:[…], offset, limit, totalItems, orderBy, nextId, prevId}`. Cloud uses cursor pagination via `nextId`/`prevId` (and `totalItems` is null); Server/DC uses `offset`/`limit`. Each promotion carries ~21 fields — a full page can exceed the response size cap and spill to a temp file, so page with a modest `limit`.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `limit` | `integer` | no | Page size for Server/DC (max 1500) |
| `offset` | `integer` | no | Skip N items for Server/DC pagination |
| `orderBy` | enum: `START_DATE` \| `EXPIRATION_DATE` \| `CREATION_DATE` | no |  |
| `activeOnly` | `boolean` | no |  |
| `hostingType` | enum: `SERVER` \| `DATA_CENTER` \| `CLOUD` | no |  |
| `appKey` | `string` | no | Filter to promotions eligible for this app key. GOTCHA: an unknown/mistyped app key is SILENTLY IGNORED by the API — it returns ALL promotions, not zero. Only a real, exact app key actually narrows the result. |
| `ascending` | `boolean` | no |  |
| `nextId` | `string` | no | Cloud-only forward page cursor |
| `prevId` | `string` | no | Cloud-only backward page cursor |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "promotions_list_paged",
    "arguments": {
      "limit": 10
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-paged-get)
