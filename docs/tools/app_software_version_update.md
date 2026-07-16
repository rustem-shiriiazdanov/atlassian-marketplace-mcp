---
title: app_software_version_update
group: Tool reference — App software (versions, tokens)
---

# `app_software_version_update`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `PUT /rest/3/app-software/{appSoftwareId}/versions/{buildNumber}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-put)

## Description

Update one version of an app-software (PUT — full replace).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `buildNumber` | `string,number` | yes |  |
| `body` | `object` | yes |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "app_software_version_update",
    "arguments": {
      "appSoftwareId": 0,
      "buildNumber": null,
      "body": {}
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-put)
