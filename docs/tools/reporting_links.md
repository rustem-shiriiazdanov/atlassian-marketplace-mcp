---
title: reporting_links
group: Tool reference — Reporting meta
---

# `reporting_links`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/developer-space/{developerId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-get)

## Description

Get the reporting root — a HAL response that lists all available reporting links for this developer space.

## Parameters

*(none)*

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "reporting_links",
    "arguments": {}
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-developer-space-developerid-get)
