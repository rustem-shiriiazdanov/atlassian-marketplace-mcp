---
title: developer_space_member_add
group: Tool reference — Developer space (admin)
---

# `developer_space_member_add`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `POST /rest/3/developer-space/{developerId}/members/{aaid}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-aaid-post)

## Description

Add a user to the developer space. AFFECTS OTHERS: grants console access to this user.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no |  |
| `aaid` | `string` | yes |  |
| `body` | `object` | no | Optional payload (role, etc.) |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "developer_space_member_add",
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
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-aaid-post)
