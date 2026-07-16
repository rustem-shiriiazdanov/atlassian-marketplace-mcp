---
title: app_software_version_get
group: Tool reference — App software (versions, tokens)
---

# `app_software_version_get`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/app-software/{appSoftwareId}/versions/{buildNumber}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-get)

## Description

Get one version of an app-software by build number.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `buildNumber` | `string,number` | yes |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "app_software_version_get",
    "arguments": {
      "appSoftwareId": 0,
      "buildNumber": null
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-get)
