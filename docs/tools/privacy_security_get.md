---
title: privacy_security_get
group: Tool reference — Privacy & security
---

# `privacy_security_get`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/privacy-and-security/products/{productId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-get)

## Description

Get privacy & security information for an app (used by enterprise procurement reviewers). Returns `{commonCloud:{dataAccessAndStorage, logDetails, dataResidency, privacy, security, properties, hasRestAPIExtension, supportsConfigurableEgress}}`. `state=live` (default) returns the published version; `state=draft` the unpublished draft (404 if none exists). Invalid state → HTTP 400.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `state` | enum: `live` \| `draft` | no | Which version to fetch: `live` (published, default) or `draft` (unpublished). Invalid → HTTP 400; `draft` → 404 if none exists. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "privacy_security_get",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>",
      "state": "live"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-get)
