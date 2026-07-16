---
title: privacy_security_publish
group: Tool reference — Privacy & security
---

# `privacy_security_publish`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `POST /rest/3/privacy-and-security/products/{productId}/publish` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-publish-post)

## Description

Publish the current draft privacy-and-security info. PUBLIC IMPACT: this version becomes visible to all Marketplace visitors and procurement reviewers.

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
    "name": "privacy_security_publish",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-privacy-and-security/#api-rest-3-privacy-and-security-products-productid-publish-post)
