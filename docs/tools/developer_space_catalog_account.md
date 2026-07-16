---
title: developer_space_catalog_account
group: Tool reference — Developer space (admin)
---

# `developer_space_catalog_account`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/developer-space/{developerId}/catalog-account` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-catalog-account-get)

## Description

Get the catalog-account ID for a developer space (used by some downstream services).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "developer_space_catalog_account",
    "arguments": {
      "developerId": ""
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-catalog-account-get)
