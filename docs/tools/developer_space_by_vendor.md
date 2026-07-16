---
title: developer_space_by_vendor
group: Tool reference — Developer space (admin)
---

# `developer_space_by_vendor`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/developer-space/vendor/{vendorId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-vendor-vendorid-get)

## Description

Resolve a developerId from a vendorId (legacy mapping).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `vendorId` | `string` | yes |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "developer_space_by_vendor",
    "arguments": {
      "vendorId": 0
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-vendor-vendorid-get)
