---
title: parent_software_version_by_build
group: Tool reference — Parent software
---

# `parent_software_version_by_build`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/parent-software/{parentSoftwareId}/versions/build/{buildNumber}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-parentsoftwareid-versions-build-buildnumber-get)

## Description

Get a parent-software version by its build number (path `/versions/build/{buildNumber}`). Returns `{buildNumber, versionNumber, hosting:[…], state, revision, createdAt}`. Unknown build → HTTP 404.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `parentSoftwareId` | `string` | yes |  |
| `buildNumber` | `string,number` | yes |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "parent_software_version_by_build",
    "arguments": {
      "parentSoftwareId": 0,
      "buildNumber": null
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-parent-software/#api-rest-3-parent-software-parentsoftwareid-versions-build-buildnumber-get)
