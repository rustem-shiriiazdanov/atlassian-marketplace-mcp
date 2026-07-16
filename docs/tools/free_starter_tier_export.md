---
title: free_starter_tier_export
group: Tool reference — Free starter tier
---

# `free_starter_tier_export`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/sales/freeStarterTier/export` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-freestartertier-export-get)

## Description

Export Cloud free-starter-tier entitlements (free users on your apps) as of a single date. Returns JSON array of `{day, licenseId, appEntitlementId, entitlementNumber, parentEdition, dateOfEvaluation, parentUnitCount, technicalEmail, vendorId, addonName, addonKey, productId}` by default; pass `accept=csv` for CSV. QUIRKS (Atlassian-side, verified 2026-06-03): (1) takes a SINGLE `date` snapshot — NOT a startDate/endDate range (ranges are silently ignored, yielding a future-dated default). (2) The CSV format OMITS the `productId` column that JSON includes (11 cols vs 12 keys). (3) A valid-shaped but non-existent `productId` returns HTTP 500 (not an empty result).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `date` | `string` | no | ISO date YYYY-MM-DD — the snapshot date. Omit for the API default (a future-dated default, so usually you want to set this). |
| `productId` | `string` | no | Product UUID — narrows the export to one app (verified: 263→50 rows, all matching). |
| `includeAtlassianLicenses` | `boolean` | no | Include internal Atlassian free-starter licenses in the export. |
| `accept` | enum: `csv` \| `json` | no | Output format: `json` (default — array of entitlement rows) or `csv`. Invalid → HTTP 400. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "free_starter_tier_export",
    "arguments": {
      "date": "2026-05-01"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-sales-freestartertier-export-get)
