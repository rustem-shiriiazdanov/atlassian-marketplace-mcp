---
title: parent_software_versions_list
group: Tool reference — Parent software
---

# `parent_software_versions_list`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/parent-software/{parentSoftwareId}/versions` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-parentsoftwareid-versions-get)

## Description

List known versions of a parent software (e.g. Jira versions Atlassian has published). CURSOR-paginated (`limit`+`cursor` from `links.next`).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `parentSoftwareId` | `string` | yes |  |
| `limit` | `integer` | no | Page size. Omit to get the full default page. |
| `cursor` | `string` | no | Opaque pagination token from a prior response's `links.next`. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "parent_software_versions_list",
    "arguments": {
      "parentSoftwareId": 0,
      "limit": 10
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-parentsoftwareid-versions-get)
