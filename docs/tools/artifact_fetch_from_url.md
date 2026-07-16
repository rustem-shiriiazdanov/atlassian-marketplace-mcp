---
title: artifact_fetch_from_url
group: Tool reference — Artifacts
---

# `artifact_fetch_from_url`

🔧 **write-safe** — writes (e.g. enqueues an async job or creates a vendor-internal record), no public-facing effect.

**📖 Spec:** `POST /rest/3/artifacts/fetch` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-assets/#api-rest-3-artifacts-fetch-post)

## Description

Have Atlassian fetch an artifact from a public URL and store it. Returns `{fileInfo, _links, details}` — the stored artifact's id/download link live under `_links`/`fileInfo`. NOTE: the API field is `uri` (not `url`); this tool accepts `url` and maps it to `uri` for you.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `url` | `string` | yes | Public URL of the artifact to fetch and store (sent to the API as the required `uri` field). |
| `extra` | `object` | no | Optional extra fields to include in the fetch request body |

## Example MCP call

JSON-RPC payload over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "artifact_fetch_from_url",
    "arguments": {
      "url": "",
      "extra": {}
    }
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-assets/#api-rest-3-artifacts-fetch-post)
