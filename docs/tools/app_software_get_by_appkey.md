---
title: app_software_get_by_appkey
group: Tool reference — App software (versions, tokens)
---

# `app_software_get_by_appkey`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/app-software/app-key/{appKey}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-app-key-appkey-get)

## Description

Look up app-software (the technical artifact behind a product listing) by its appKey. Returns an ARRAY of `{appSoftwareId, hosting, complianceBoundaries, archived}` — one entry per hosting platform the app supports. `complianceBoundaries` is a Cloud-only concept (an array like `["commercial"]` for cloud, `null` for server/datacenter). Use `hosting` to narrow to a single entry.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `appKey` | `string` | yes | App key like 'com.example.your-app' |
| `hosting` | enum: `cloud` \| `server` \| `datacenter` | no | Narrow to one hosting platform's app-software entry. Invalid → HTTP 400. |
| `complianceBoundaries` | `string` | no | Filter by compliance boundary (e.g. `commercial`). |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "app_software_get_by_appkey",
    "arguments": {
      "appKey": "your.app.key",
      "hosting": "cloud"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-app-key-appkey-get)
