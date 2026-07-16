---
title: transactions_export_async_download
group: Tool reference — Transactions
---

# `transactions_export_async_download`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/transactions/async/export/{exportId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-async-export-exportid-get)

## Description

Download a completed async transactions export. Returns the JSON array of transaction records. Request timeout is 10 min (overridable via EXPORT_TIMEOUT_MS env). Only call this after the *_status endpoint reports DONE — otherwise you'll get a 404 'Export is being processed'.

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
    "name": "transactions_export_async_download",
    "arguments": {
      "exportId": "export-id-from-async-start"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-transactions-async-export-exportid-get)
