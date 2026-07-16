---
title: feedback_details
group: Tool reference — Feedback
---

# `feedback_details`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/feedback/details` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-feedback-details-get)

## Description

Raw customer feedback entries (uninstall/disable/unsubscribe events with reasons + free-text messages). Returns `{_links:{self,query,next}, feedback:[{addonKey, addonVersion, applicationKey, applicationVersion, hosting, date, feedbackType, reasonKey, reason, message, fullName, appEntitlementId, appEntitlementNumber, productId}]}`. `_links.next` paginates. Filter by type/reason/hosting/addon/productId/anonymous/text + date range. NOTE: contains customer PII (names, free-text comments).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `productId` | `string` | no | Product UUID. Narrows to one app. (Not in the HAL template but works.) Prefer this or `addon`, not both. |
| `addon` | `string` | no | App key (e.g. `com.example.your-app`). Narrows to one app. Alternative to `productId`. |
| `type` | enum: `uninstall` \| `disable` \| `unsubscribe` | no | Feedback event type (maps to response `feedbackType`). Strict enum — invalid → HTTP 400. |
| `reason` | `string` | no | Filter by `reasonKey`. Observed values: bugs, merging, not-meeting-needs, other, project-based, sandbox, usefulness. |
| `hosting` | enum: `cloud` \| `datacenter` \| `server` | no | Filter by hosting. Response uses 'Cloud'/'Server'/'Data Center'. |
| `appEdition` | enum: `free` \| `standard` \| `advanced` | no | Filter by app edition (free/standard/advanced) — documented in the spec + verified to narrow (2026-06-03). |
| `anonymous` | `boolean` | no | `true` returns only anonymized feedback (empty `fullName`); `false` only attributed. Invalid value → 400. |
| `text` | `string` | no | Free-text search across the feedback message and identifiers. |
| `startDate` | `string` | no | ISO date YYYY-MM-DD (filters by feedback date). |
| `endDate` | `string` | no | ISO date YYYY-MM-DD. |
| `offset` | `integer` | no |  |
| `limit` | `integer` | no | Max 50 (server cap). `_links.next` carries the next page. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "feedback_details",
    "arguments": {
      "productId": "<product-uuid-from-apps_list>"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-feedback-details-get)
