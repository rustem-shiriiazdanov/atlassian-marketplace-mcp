---
title: parent_software_version_by_number
group: Tool reference — Parent software
---

# `parent_software_version_by_number`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/parent-software/{id}/versions/number/{versionNumber}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-id-versions-number-versionnumber-get)

## Description

Get a parent-software version by its human-readable version number (path `/versions/number/{versionNumber}`, e.g. '11.3.8'). Same record shape as version_by_build (`{buildNumber, versionNumber, hosting, state, revision, createdAt}`). Unknown version → HTTP 404.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `parentSoftwareId` | `string` | yes |  |
| `versionNumber` | `string` | yes |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "parent_software_version_by_number",
    "arguments": {
      "parentSoftwareId": 0,
      "versionNumber": ""
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-id-versions-number-versionnumber-get)
