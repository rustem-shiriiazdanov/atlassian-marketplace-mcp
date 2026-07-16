---
title: app_requests_and_approvals
group: Tool reference — App requests & approvals
---

# `app_requests_and_approvals`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/app-requests-and-approvals` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-app-requests-and-approvals-get)

## Description

Marketplace 'request app' / 'approve app' activity, per month. Benchmark-style aggregate (NOT a paginated list): `{total:{name, appRequestsAndApprovalsPerMonth:[{date, appRequests, appRequestsApproved, appRequestsApprovalRate}]}, addons:[{addonKey, name, productId, appRequestsAndApprovalsPerAppPerMonth}]}`. Filter by addon (app key) or productId; hosting/pagination are silently ignored.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID. Narrows to one app. (Not in the HAL template but works.) |
| `addon` | `string` | no | App key (e.g. `com.example.your-app`). Narrows to one app. Alternative to `productId`. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD. |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "app_requests_and_approvals",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-app-requests-and-approvals-get)
