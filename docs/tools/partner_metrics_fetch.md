---
title: partner_metrics_fetch
group: Tool reference — Partner metrics
---

# `partner_metrics_fetch`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `POST /rest/3/partner-metrics/developer-space/{developerId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-partner-metrics-developer-space-developerid-post)

## Description

Fetch partner-metric time series (POST). The `body` shape is `ReportingMetricTimeSeriesRequestBody`: `{metrics:{metricSets:[…], metricFields:[…]}, dateRange:{startDate, endDate}, granularity:'YEAR'|'MONTH'|'WEEK'|'DAY', attributes?, sortByList?, attributeFilter?}`. IMPORTANT: `metrics` is an OBJECT (not an array) and `metricSets`/`metricFields` are arrays of OBJECTS; `dateRange` uses `startDate`/`endDate` (not start/end). A wrong shape returns HTTP 400 with a JSON-parse error message. `limit`/`offset` are query params for paging the result rows.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `developerId` | `string` | no |  |
| `limit` | `integer` | no | Max result rows to return. |
| `offset` | `integer` | no | Result-row offset for paging. |
| `body` | `object` | yes | ReportingMetricTimeSeriesRequestBody — see the tool description for the required shape. |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "partner_metrics_fetch",
    "arguments": {
      "body": {},
      "developerId": ""
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-partner-metrics-developer-space-developerid-post)
