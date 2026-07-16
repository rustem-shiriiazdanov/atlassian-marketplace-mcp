---
title: parent_software_get
group: Tool reference — Parent software
---

# `parent_software_get`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/parent-software/{parentSoftwareId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-parentsoftwareid-get)

## Description

Get one parent software (Atlassian product) by ID (e.g. `jira`, `confluence`). Returns `{id, developerId:'Atlassian', name, hostingOptions:[{hosting}], extensibilityFrameworks, state, revision}`. Nonexistent id → HTTP 404.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `parentSoftwareId` | `string` | yes | Parent-software id, e.g. `jira` (from parent_software_list). |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "parent_software_get",
    "arguments": {
      "parentSoftwareId": 0
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-parentsoftwareid-get)
