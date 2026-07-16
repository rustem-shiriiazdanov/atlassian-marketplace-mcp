---
title: developer_space_get
group: Tool reference — Developer space (admin)
---

# `developer_space_get`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/developer-space/{developerId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-get)

## Description

Get developer space profile by developerId. Returns `{id, vendorId, name, status, type, organisationId, version}`. Defaults to MARKETPLACE_DEVELOPER_ID. Unknown/malformed id → HTTP 400.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no | Defaults to MARKETPLACE_DEVELOPER_ID |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "developer_space_get",
    "arguments": {
      "developerId": ""
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-get)
