---
title: product_catalog_latest
group: Tool reference — Product catalog
---

# `product_catalog_latest`

🟢 **read-only** — safe to call freely; no side effects.

**📖 Spec:** `GET /rest/3/reporting/product-catalog/latest` — [Atlassian docs](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-product-catalog-latest-get)

## Description

Get a presigned S3 URL for the latest public Marketplace app-catalog snapshot. Response shape: {date, presignedUrl, expiresInSeconds}. The presignedUrl points to a LARGE CSV file (~150 MB, Content-Type binary/octet-stream — NOT JSON), one row per published app with columns like: is_beta, summary, tag_line, is_connect, product_id, released_at, vendor_name, is_supported, review_score, average_stars, install_count, download_count, version_number, version_status, publicly_visible, number_of_reviews, category_name_list, marketplace_app_key, app_software_hosting. This is the whole public app marketplace (all vendors' apps), NOT your own apps or Atlassian's product/pricing structure. presignedUrl expires in ~300s — download promptly.

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
    "name": "product_catalog_latest",
    "arguments": {}
  }
}
```

## See also

- [Full tool catalog](../TOOLS.md)
- [Architecture notes](../ARCHITECTURE.md)
- [Atlassian spec](https://developer.atlassian.com/platform/marketplace/rest/v4/api-group-reporting/#api-rest-3-reporting-product-catalog-latest-get)
