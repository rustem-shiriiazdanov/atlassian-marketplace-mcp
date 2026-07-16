---
title: app_software_token_create
group: Tool reference — App software (versions, tokens)
---

# `app_software_token_create`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `POST /rest/3/app-software/{id}/tokens` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-id-tokens-post)

## Description

Create a new access token for this app-software. CREDENTIAL: the returned token must be stored securely — Atlassian will not show it again.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `body` | `object` | no | Optional token-creation payload (scope, label, etc.) |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "app_software_token_create",
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
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-id-tokens-post)
