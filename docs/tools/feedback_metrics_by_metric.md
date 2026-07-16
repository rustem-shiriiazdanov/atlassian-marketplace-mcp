---
title: feedback_metrics_by_metric
group: Tool reference — Feedback
---

# `feedback_metrics_by_metric`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}/feedback/metrics/{metric}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-feedback-metrics-metric-get)

## Description

Feedback time-series grouped by a metric. FLAT `total.series[]` (no datasets, no uniqueTotal) — one series per group value, each `{name, elements:[{date,count}]}` — plus per-app `addons[]`. For `metric=reason` series are reasonKeys (bugs, merging, not-meeting-needs, other, project-based, sandbox, usefulness); for `metric=type` series are feedbackTypes (disable, uninstall, unsubscribe). Only aggregation/startDate/endDate filter (productId/hosting/addon are ignored).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `metric` | enum: `reason` \| `type` | yes | Path segment. Allowable per Atlassian: `reason` or `type`. Anything else → HTTP 400. |
| `aggregation` | enum: `week` \| `month` | no | Time-series bucket cadence. Default week. Invalid → 400. |
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
    "name": "feedback_metrics_by_metric",
    "arguments": {
      "metric": "reason",
      "aggregation": "week"
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-feedback-metrics-metric-get)
