---
title: developer_space_members_list
group: Tool reference — Developer space (admin)
---

# `developer_space_members_list`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/developer-space/{developerId}/members?limit={limit}&cursor={cursor}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-limit-limit-cursor-cursor-get)

## Description

List team members in the developer space. Returns `{members:[{aaid, roles, categories, email, userName}], next}`. CURSOR-paginated, but with a NON-STANDARD shape (unlike the `links.next` URL used by other list tools): `next` is a BARE opaque cursor token (or absent on the last page) — pass its value straight back as the `cursor` param to get the following page. Page size via `limit` (default 10, max 50).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no |  |
| `cursor` | `string` | no | Opaque token from the previous response's top-level `next` field (a bare token, NOT a URL). |
| `limit` | `integer` | no | Page size (default 10, max 50). |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "developer_space_members_list",
    "arguments": {
      "developerId": ""
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-developer-space/#api-rest-3-developer-space-developerid-members-limit-limit-cursor-cursor-get)
