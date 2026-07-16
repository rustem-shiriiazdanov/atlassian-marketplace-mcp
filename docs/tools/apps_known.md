---
title: apps_known
group: Tool reference — Apps discovery
---

# `apps_known`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/product-listing/developer-space/{developerId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-developer-space-developerid-get)

> **Note:** Local env map — closest related endpoint is apps_list

## Description

Return the static name -> productId map loaded from PRODUCT_ID_* env vars. Use this to look up product UUIDs by friendly name without an API call.

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
    "name": "apps_known",
    "arguments": {}
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-listing/#api-rest-3-product-listing-developer-space-developerid-get)
