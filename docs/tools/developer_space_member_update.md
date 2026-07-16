---
title: developer_space_member_update
group: Tool reference — Developer space (admin)
---

# `developer_space_member_update`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `PUT /rest/3/developer-space/{developerId}/members/{aaid}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-aaid-put)

## Description

Update a developer-space team member (PUT — full replace).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no |  |
| `aaid` | `string` | yes |  |
| `body` | `object` | yes |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "developer_space_member_update",
    "arguments": {
      "aaid": "",
      "body": {},
      "developerId": ""
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-aaid-put)
