---
title: cloud_migration_compat_get
group: Tool reference — Cloud migration compatibility
---

# `cloud_migration_compat_get`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/cloud-migration-compatibility/products/{productId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-migrations/#api-rest-3-cloud-migration-compatibility-products-productid-get)

## Description

Get DC-to-Cloud migration compatibility info for an app. Returns `{developerId, productId, addonKey, addonName, cloudMigrationAssistantCompatibility, migrationPath, isDualLicenseOptedIn}`. NOTE: returns HTTP 404 (surfaced as an error) for apps that have no migration-compatibility record configured — not every app has one. No query params; productId is a path segment.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | yes | Product UUID (path segment). |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "cloud_migration_compat_get",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-migrations/#api-rest-3-cloud-migration-compatibility-products-productid-get)
