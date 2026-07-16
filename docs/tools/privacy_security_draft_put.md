---
title: privacy_security_draft_put
group: Tool reference — Privacy & security
---

# `privacy_security_draft_put`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `PUT /rest/3/privacy-and-security/products/{productId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-put)

## Description

Create or update the draft privacy-and-security information (not yet public). PUT — full replace.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `body` | `object` | yes | Full privacy-and-security payload |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "privacy_security_draft_put",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>",
      "body": {}
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-put)
