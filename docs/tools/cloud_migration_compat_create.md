---
title: cloud_migration_compat_create
group: Tool reference — Cloud migration compatibility
---

# `cloud_migration_compat_create`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `PUT /rest/3/cloud-migration-compatibility/products/{productId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-migrations/#api-rest-3-cloud-migration-compatibility-products-productid-put)

## Description

Create cloud-migration compatibility info for an app. PUT semantics — body is the full document.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `body` | `object` | yes | Migration compatibility payload |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "cloud_migration_compat_create",
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
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-migrations/#api-rest-3-cloud-migration-compatibility-products-productid-put)
