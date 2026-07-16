---
title: app_software_tokens_list
group: Tool reference — App software (versions, tokens)
---

# `app_software_tokens_list`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/app-software/{id}/tokens` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-id-tokens-get)

## Description

List API access tokens minted for this app-software. Returns `{tokens:[{token, cloudId, instance}]}` — each token maps to one Cloud install. CREDENTIAL-ADJACENT: exposes token identifiers + the customer cloud sites they belong to.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `token` | `string` | no | Look up a specific token value (spec param; accepted, filters server-side). |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "app_software_tokens_list",
    "arguments": {
      "appSoftwareId": 0,
      "token": ""
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-software/#api-rest-3-app-software-id-tokens-get)
