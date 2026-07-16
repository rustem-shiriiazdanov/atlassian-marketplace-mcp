---
title: privacy_security_draft_delete
group: Tool reference — Privacy & security
---

# `privacy_security_draft_delete`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `DELETE /rest/3/privacy-and-security/products/{productId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-delete)

## Description

Delete the draft privacy-and-security info (the currently published version is unaffected).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "privacy_security_draft_delete",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-delete)
