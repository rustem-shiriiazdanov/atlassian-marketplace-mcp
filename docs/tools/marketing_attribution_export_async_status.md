---
title: marketing_attribution_export_async_status
group: Tool reference — Marketing attribution
---

# `marketing_attribution_export_async_status`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/async/export/{exportId}/status` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-async-export-exportid-status-get)

## Description

Poll status of an async marketing-attribution export job. NOTE the generic /async/export/ path (shared, not prefixed).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `exportId` | `string` | yes |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "marketing_attribution_export_async_status",
    "arguments": {
      "exportId": "export-id-from-async-start"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-async-export-exportid-status-get)
