---
title: artifact_get
group: Tool reference — Artifacts
---

# `artifact_get`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/artifacts/{artifactId}` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-assets/#api-rest-3-artifacts-artifactid-get)

## Description

Get artifact metadata (name, size, content type, download URL).

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `artifactId` | `string` | yes |  |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "artifact_get",
    "arguments": {
      "artifactId": ""
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-assets/#api-rest-3-artifacts-artifactid-get)
