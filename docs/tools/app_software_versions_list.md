---
title: app_software_versions_list
group: Tool reference — App software (versions, tokens)
---

# `app_software_versions_list`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/app-software/{appSoftwareId}/versions` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-get)

## Description

List versions for an app-software. Returns `{links, versions:[{buildNumber, versionNumber, compatibilities, supportedPaymentModel, frameworkDetails, licenseType, ...}], totalCount}`. CURSOR-paginated (`limit`+`cursor` from `links.next`) — `offset` is NOT supported (silently ignored).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `limit` | `integer` | no | Page size. |
| `cursor` | `string` | no | Opaque pagination token from `links.next`. |
| `state` | enum: `draft` \| `submitted` \| `approved` \| `auto-approved` \| `active` \| `rejected` \| `archived` | no | Filter by version state. |
| `paymentModel` | enum: `free` \| `paid-via-atlassian` \| `paid-via-vendor` | no | Filter by payment model. Invalid → HTTP 400. |
| `parentSoftwareId` | `string` | no | Filter by parent software (Atlassian product) id. Invalid → HTTP 400. |
| `parentSoftwareVersionId` | `string` | no | Filter by a specific parent-software version id. |
| `afterVersion` | `string` | no | Return versions after this version number. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "app_software_versions_list",
    "arguments": {
      "appSoftwareId": 0,
      "limit": 10
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-appsoftwareid-versions-get)
