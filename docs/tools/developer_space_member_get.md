---
title: developer_space_member_get
group: Tool reference — Developer space (admin)
---

# `developer_space_member_get`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/developer-space/{developerId}/members/{aaid}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-aaid-get)

## Description

Get one developer-space team member by Atlassian account id (aaid). Returns `{aaid, roles, categories, email, userName}` — contains PII (email, userName). Unknown aaid → HTTP 400.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no |  |
| `aaid` | `string` | yes | Atlassian account ID |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "developer_space_member_get",
    "arguments": {
      "aaid": "",
      "developerId": ""
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-aaid-get)
