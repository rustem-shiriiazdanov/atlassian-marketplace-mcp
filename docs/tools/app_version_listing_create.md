---
title: app_version_listing_create
group: Tool reference — App version listing
---

# `app_version_listing_create`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `POST /rest/3/app-software/{appSoftwareId}/versions/{buildNumber}/listing` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-version-listing/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-listing-post)

## Description

Create a new version-listing for a specific build. PUBLIC IMPACT (after approval): publishes a new app version to the Marketplace.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `buildNumber` | `string,number` | yes |  |
| `body` | `object` | yes | Version listing payload |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "app_version_listing_create",
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
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-version-listing/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-listing-post)
