---
title: promotions_list
group: Tool reference — Promotions
---

# `promotions_list`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /catalog/partners/{partnerId}/promotions` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-get)

> **Note:** Deprecated non-paged variant; prefer promotions_list_paged

## Description

List ALL promotions in one non-paginated response (legacy). WARNING: on partners with many promotions this endpoint is very slow and can hit the request timeout (60s, then retried) — effectively hanging. Prefer promotions_list_paged in almost all cases; use this only when you truly need every promotion at once and know the set is small.

## Parameters

*(none)*

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "promotions_list",
    "arguments": {}
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v1/api-group-promotions/#api-marketplace-catalog-partners-partnerid-promotions-get)
