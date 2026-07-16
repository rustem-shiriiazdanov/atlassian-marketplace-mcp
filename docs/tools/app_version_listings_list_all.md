---
title: app_version_listings_list_all
group: Tool reference — App version listing
---

# `app_version_listings_list_all`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/app-software/{appSoftwareId}/listings/all` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-version-listing/#api-rest-3-app-software-appsoftwareid-listings-all-get)

## Description

List version-listings for an app-software (per-version published metadata: screenshots, highlights, moreDetails, youtubeId, developerLinks, approvalStatus, state, buildNumber, revision). Returns `{links, versions:[…]}`. Despite the name, it's CURSOR-paginated (default 10/page; pass `cursor` from `links.next`). Filter by `state` (PRIVATE/PUBLIC) and `approvalStatus` (both verified to narrow at the payload level; an unknown value returns an empty list, not an error).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `appSoftwareId` | `string` | yes |  |
| `limit` | `integer` | no | Page size (default 10). |
| `cursor` | `string` | no | Opaque pagination token from `links.next`. |
| `state` | enum: `PRIVATE` \| `PUBLIC` | no | Filter by listing visibility state. |
| `approvalStatus` | enum: `APPROVED` \| `SUBMITTED` \| `REJECTED` \| `UNINITIATED` | no | Filter by Marketplace approval status. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "app_version_listings_list_all",
    "arguments": {
      "appSoftwareId": 0,
      "limit": 10
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-app-version-listing/#api-rest-3-app-software-appsoftwareid-listings-all-get)
