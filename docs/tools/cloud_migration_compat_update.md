---
title: cloud_migration_compat_update
group: Tool reference — Cloud migration compatibility
---

# `cloud_migration_compat_update`

⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.

**📖 Spec:** `PATCH /rest/3/cloud-migration-compatibility/products/{productId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-migrations/#api-rest-3-cloud-migration-compatibility-products-productid-patch)

## Description

Patch cloud-migration compatibility info (partial update).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes |  |
| `body` | `object` | yes | Partial migration compatibility payload |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "cloud_migration_compat_update",
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
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-migrations/#api-rest-3-cloud-migration-compatibility-products-productid-patch)
