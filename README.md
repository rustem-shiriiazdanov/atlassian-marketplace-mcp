# atlassian-marketplace-mcp

A Model Context Protocol server that exposes the Atlassian Marketplace vendor APIs (reporting + v1 promotions) as **95 tools**, **3 resources**, and **4 prompts**. Lets an LLM look up licenses, query transactions, manage promotions, read reviews, pull churn/conversion/renewal metrics, inspect app listings, and more — without you writing curl one-liners. Every tool is annotated per the MCP 2024-11 spec (`readOnlyHint` / `destructiveHint`) so MCP-aware UIs can render safety warnings automatically.

Targets **Marketplace vendors** (people who sell apps on `marketplace.atlassian.com`). Not for end users of Marketplace apps.

> **What is MCP?** [Model Context Protocol](https://modelcontextprotocol.io/) is an open standard for connecting AI assistants (Claude, etc.) to external data sources and tools. This server runs as a child process of your MCP client (Claude Code, Claude Desktop, etc.) and speaks MCP over stdio.

## What's covered

| Area | Tools | What it's for |
|---|---|---|
| Apps | 2 | Discover your apps & their UUIDs |
| Promotions | 10 | Full CRUD on promos and single-use codes |
| Licenses | 5 | List, search by SEN, CSV exports (sync + async) |
| Transactions | 7 | Sales history, aggregates, exports |
| Reporting metrics | 20 | Churn, conversion, renewal, evaluations, feedback, customer insights, benchmarks, marketing attribution |
| Reviews | 4 | Read reviews, respond, delete responses |
| Search keywords | 8 | What customers search for to find your apps |
| App listing & versions | 13 | Listing metadata, version management, tokens |
| Privacy, security, migrations | 7 | Compliance metadata + DC→Cloud migration info |
| Admin (developer space) | 9 | Team members, catalog account |
| Misc | 10 | Parent software, partner metrics, product catalog, artifacts, free-starter tier |

Full per-tool catalog: [`docs/TOOLS.md`](docs/TOOLS.md). Design notes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Prerequisites

- **Node.js ≥ 20** (uses native `fetch` and ES modules)
- An **Atlassian account with vendor access** to your developer space
- An **Atlassian API token** — create one at `id.atlassian.com` → **Security → API tokens**

## Install

```bash
git clone <this repo>
cd Atlassian_mcp
npm install
npm run build
```

## Configure

Copy the example env file and fill it in:

```bash
cp .env.example .env
```

The four required variables:

| Var | Where to get it |
|---|---|
| `ATLASSIAN_EMAIL` | Your Atlassian login email |
| `ATLASSIAN_API_TOKEN` | Created at `id.atlassian.com → Security → API tokens` |
| `MARKETPLACE_DEVELOPER_ID` | UUID of your developer space — see below |
| `MARKETPLACE_PARTNER_ID` | Numeric partner ID for the v1 promotions API |

### Finding your developerId and partnerId

Both are visible in the Atlassian Marketplace partner console URL when you're logged in, or you can resolve `developerId` from `vendorId` via the API:

```bash
# Replace EMAIL, TOKEN, VENDOR_ID with yours
curl -u "EMAIL:TOKEN" \
  "https://api.atlassian.com/marketplace/rest/3/developer-space/vendor/VENDOR_ID"
```

The numeric `partnerId` shows up in the Marketplace partner console URL (e.g. `marketplace.atlassian.com/manage/vendors/<partnerId>`). Often it's the same number as your vendorId, but not always — verify.

### Optional: known product IDs

Add `PRODUCT_ID_<UPPER_SNAKE>=<uuid>` lines to `.env` for each of your apps. They're then accessible via the `apps_known` tool as a friendly-name → UUID map, so the LLM can say "My App Name" without having to call `apps_list` every time.

Discover the right UUIDs first via:

```bash
node dist/server.js  # in another shell, send tools/call apps_list
# Or use the apps_list MCP tool from a connected client.
```

## npm scripts

| Script | What it does |
|---|---|
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run dev` | `tsc --watch` — recompile on save |
| `npm run typecheck` | Strict typecheck without emitting output |
| `npm start` | Run the compiled server (`node dist/server.js`) |

## Run

```bash
npm start
# or directly:
node dist/server.js
```

The server speaks MCP over stdio. It will wait for an MCP client to connect. To smoke-test by hand:

```bash
# Send a tools/list request via stdin to see all 95 tools
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"sh","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node dist/server.js
```

## Wire into Claude Code

Add this to your `~/.claude.json` under `mcpServers` (or a project-local `.mcp.json`):

```json
{
  "mcpServers": {
    "atlassian-marketplace": {
      "command": "node",
      "args": ["/absolute/path/to/Atlassian_mcp/dist/server.js"]
    }
  }
}
```

Restart Claude Code. The 95 tools are then available as `mcp__atlassian-marketplace__*` in your next session.

## Example prompts

Once wired in, try:

- *"Show me the last 10 transactions in Q1 2026 for &lt;my app&gt;."*
- *"What's our cloud churn rate this month?"*
- *"List all active promotions expiring this quarter."*
- *"Look up license SEN-LXXXXXXXX and tell me when it expires."*
- *"Pull customer insights by region for &lt;my app&gt;."*
- *"Create a 25% promo code for &lt;my app&gt;, valid until 2026-12-31, single-use, Cloud annual."*

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `HTTP 401 ...` | Bad email or API token | Re-issue token at `id.atlassian.com` |
| `HTTP 404 ...` on reporting endpoints | Wrong `MARKETPLACE_DEVELOPER_ID` | Resolve via `/developer-space/vendor/{vendorId}` |
| `HTTP 404` on promotions endpoints | Wrong `MARKETPLACE_PARTNER_ID` | Check the URL in the Marketplace partner console |
| `promotions_list` times out / hangs | Atlassian-side: the deprecated non-paged variant is unresponsive | Use `promotions_list_paged` instead |
| Empty result when filtering by `productId` | You passed the appKey instead of the UUID | Get the UUID via `apps_list` or `apps_known` |
| An expected app is missing from `apps_list` | The app may live under a different developer-space | One MCP instance per developer-space; run a second instance with different env if needed |
| Multipart upload (artifact / image) | Not supported | Use Marketplace Partner UI for these uploads |

## Project structure

```
src/
├─ server.ts                # MCP stdio entrypoint, registers all 25 tool modules
├─ config.ts                # env loader, single API base, PRODUCT_ID_* map
├─ http-client.ts           # Basic-auth fetch wrapper, 429 retry
└─ tools/
   ├─ _shared.ts            # jsonResult, asQuery, REPORTING_BASE/PROMO_BASE, filter schemas
   ├─ apps.ts               # apps_list, apps_known
   ├─ promotions.ts         # 10 promo tools (v1)
   ├─ licenses.ts           # 5 license tools (reporting)
   ├─ transactions.ts       # 7 transaction tools (reporting)
   ├─ reporting-meta.ts     # reporting_links
   ├─ evaluations.ts        # evaluations_by_metric
   ├─ feedback.ts           # 2 feedback tools
   ├─ customer-insights.ts  # 4 customer insights tools
   ├─ sales-metrics.ts      # 6 sales-metric tools
   ├─ benchmarks.ts         # 2 benchmark tools
   ├─ marketing-attribution.ts # 3 async-export tools
   ├─ app-requests.ts       # app_requests_and_approvals
   ├─ reviews.ts            # 4 review tools
   ├─ search-keywords.ts    # 8 keyword tools
   ├─ free-starter.ts       # free_starter_tier_export
   ├─ app-listing.ts        # 2 product listing tools
   ├─ app-software.ts       # 7 app-software tools
   ├─ app-version-listing.ts# 4 version-listing tools
   ├─ privacy-security.ts   # 4 privacy/security tools
   ├─ migrations.ts         # 3 cloud-migration compat tools
   ├─ parent-software.ts    # 5 parent-software tools
   ├─ developer-space.ts    # 9 dev-space admin tools
   ├─ partner-metrics.ts    # partner_metrics_fetch
   ├─ product-catalog.ts    # product_catalog_latest
   └─ artifacts.ts          # artifact_fetch_from_url, artifact_get
```

## Further reading

- [`docs/TOOLS.md`](docs/TOOLS.md) — every tool with its args
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — design decisions and gotchas
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — version history
- Atlassian Marketplace API reference: <https://developer.atlassian.com/platform/marketplace/rest/v4/>
  (Atlassian's docs site versions the **content** as `/v4/`. The URL paths we actually hit are still `/rest/3/...` — that's the wire format. The older `/v3/` docs path on the developer site corresponds to the deprecated v2 wire format and is NOT what this MCP targets.)
- Model Context Protocol spec: <https://modelcontextprotocol.io/>

## License

[MIT](LICENSE) © 2026 Rustem Shiriiazdanov. Use it, fork it, ship it.
