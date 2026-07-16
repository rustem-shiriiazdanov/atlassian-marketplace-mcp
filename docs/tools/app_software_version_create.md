---
title: app_software_version_create
group: Tool reference — App software (versions, tokens)
---

# `app_software_version_create`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `POST /rest/3/app-software/{appSoftwareId}/versions` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-post)

## Description

Create a new version for an app-software. PUBLIC IMPACT (eventually): once a version is approved and listing is published, customers can install it.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `body` | `object` | yes | Version creation payload |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "app_software_version_create",
    "arguments": {
      "appSoftwareId": 0,
      "body": {}
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-post)
