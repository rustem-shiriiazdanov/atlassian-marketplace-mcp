---
title: app_version_listing_get
group: Tool reference — App version listing
---

# `app_version_listing_get`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/app-software/{appSoftwareId}/versions/{buildNumber}/listing` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-version-listing/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-listing-get)

## Description

Get the version-listing for a specific build number.

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
    "name": "app_version_listing_get",
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
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-version-listing/#api-rest-3-app-software-appsoftwareid-versions-buildnumber-listing-get)
