# Architecture

## API surface

Everything goes through one host: **`https://api.atlassian.com/marketplace/`**.

Two distinct API generations share this base:

- **Reporting & content management** — `/rest/3/...` — covers licenses, transactions, evaluations, feedback, customer insights, churn/conversion/renewal metrics, search keywords, marketing attribution, app listings, app-software versions, privacy & security, migrations, parent-software, developer-space admin, artifacts, product catalog. **85 endpoints.** Documented by Atlassian at <https://developer.atlassian.com/platform/marketplace/rest/v4/> — note their docs site labels this content as `/v4/` even though the URL paths are `/rest/3/...` (the `/v3/` docs path is for the deprecated v2 wire format, which this MCP does NOT use).
- **v1 promotions** — `/catalog/partners/.../promotions/...` — full CRUD for promo codes (shared + single-use). **10 endpoints.**

Originally we modelled them as two hosts (`marketplace.atlassian.com` vs `api.atlassian.com`) and discovered during smoke testing that both reporting **and** v1 promotions are served from `api.atlassian.com/marketplace/`. The `http-client.ts` collapsed to a single `apiBase` constant.

## Authentication

**HTTP Basic auth** with `<atlassian-email>:<api-token>` — created at `id.atlassian.com → Security → API tokens`. Same credentials work for both API generations.

Forge and OAuth2 (3LO) **cannot** call these endpoints — vendor-scoped APIs require Basic auth with vendor credentials. This is why the official `mcp.atlassian.com` connector (which uses OAuth) covers Jira/Confluence/Compass but not vendor data.

## Identifiers

Three IDs come up — they are NOT interchangeable:

| ID | Format | Used by | Resolved via |
|---|---|---|---|
| `developerId` | UUID | reporting & listing endpoints | `GET /rest/3/developer-space/vendor/{vendorId}` |
| `partnerId` | integer | v1 promotions endpoints | Marketplace partner console URL |
| `productId` | UUID | most reporting filters | `apps_list` tool, or `GET /rest/3/product-listing/developer-space/{developerId}` |

**Common pitfall — `productId` is a UUID, not an app key.** Hardcoded product UUIDs go stale when apps are re-listed under a new product entry. Always cross-check with `apps_list` (or discover at runtime) before pinning IDs into env vars.

A second pitfall: the spec's `productId` query parameter is declared as `array` with `style: form, explode: false` — which would imply a comma-separated list (`?productId=uuid1,uuid2`). But probing the live API shows **the comma form is silently mis-parsed** — only the repeated-param form (`?productId=a&productId=b`) actually filters correctly. Since our `http-client.ts` only emits one value per key, **for multi-product queries make separate calls and union client-side**.

## Env-driven product-id map

The `PRODUCT_ID_<NAME>` env var pattern is picked up at startup by `loadKnownProductIds()` in `src/config.ts`. Anything matching the prefix becomes a friendly-name → UUID entry in `config.knownProductIds`, which the `apps_known` tool returns.

This lets the LLM use a friendly app name and have a deterministic way to translate to a UUID without an API call. Discovery (`apps_list`) is the source of truth — env is the cache.

## Async export pattern

Three endpoint families support asynchronous CSV export of large datasets:

- **Licenses** — `POST /licenses/async/export` (start) + `GET /licenses/async/export/{exportId}/status` + `GET /licenses/async/export/{exportId}` (download)
- **Transactions** — same shape, prefixed `/sales/transactions/async/export`
- **Marketing attribution** — start is prefixed (`/marketing-attribution/async/export`) but the **status and download paths use the GENERIC `/async/export/{exportId}` route** (no `marketing-attribution/` prefix). Gotcha — easy to mirror the licenses/transactions pattern and end up with 404s.

Each domain has three MCP tools (`*_export_async_start`, `_status`, `_download`). Marketing attribution's download tool hits the unprefixed path explicitly — this is documented in `src/tools/marketing-attribution.ts`.

For most queries, the **sync export** variant (`*_export_sync`) is fine. The async path exists because sync 5xx's on large date ranges.

## Error handling

`src/http-client.ts` does the bare minimum:

- 429 → respect `Retry-After`, retry up to 3 times
- Anything else non-2xx → throw with `HTTP <code> <method> <url>: <body excerpt>`

No circuit breaker, no caching, no rate-limit budgeting. The MCP runs as a child process per Claude Code session; rate limits in practice aren't a problem.

## Large-response handling

Some endpoints return very large JSON (customer-insights, transactions over long ranges, all search-keywords exports). The LLM's context budget can't accommodate ~200k-char responses.

`jsonResult()` in `src/tools/_shared.ts` enforces a soft cap (default 50,000 chars, override via `MAX_RESPONSE_CHARS` env). Over the cap, the response is written to `${os.tmpdir()}/atlassian-mcp-<sha1>.<ext>` (content-hashed filename so repeat calls dedupe) and the tool returns a small summary:

```json
{
  "_truncated": true,
  "_file": "/tmp/atlassian-mcp-abc123.json",
  "_bytes": 199842,
  "_chars": 199840,
  "_hint": "The COMPLETE payload was written to _file — read it to get the full dataset; this envelope is only a preview. Alternatives: narrow the date range, use aggregation=month, or set MAX_RESPONSE_CHARS=0.",
  "_preview": "<first 2000 chars>"
}
```

The `_file` holds the **complete** payload (verified byte-for-byte against the inline response) — the host LLM reads it with whatever filesystem tools it has. `_bytes` is the true on-disk UTF-8 byte size; `_chars` is the JS string length (these differ for multibyte content). The extension is `.json` when the payload looks like JSON, else `.txt` (so CSV exports land as `.txt`).

**Three ways to get the full data:** (1) read `_file`; (2) set `MAX_RESPONSE_CHARS=0` (or any non-positive value) to disable truncation entirely and return everything inline; (3) narrow the query (date range / coarser aggregation). Note: `=0` correctly means "unlimited" — earlier it had an off-by-one that made `0` truncate everything; fixed so non-positive ⇒ `Infinity`.

## Tool annotations (MCP 2024-11)

Every tool declares its safety profile via the standard `annotations` object:

- `readOnlyHint` — tool does not modify state (71 of 95 tools)
- `destructiveHint` — tool may delete or overwrite data, OR has public impact (20 tools)
- `idempotentHint` — calling twice produces the same result (true for read-only)
- `openWorldHint` — tool talks to an external system (always true here — Atlassian API)

The three constants `READ_ONLY`, `WRITE_SAFE`, `DESTRUCTIVE` are defined in `_shared.ts` and passed to `server.tool(...)` as the 4th argument. A future MCP-aware UI can render warnings, gate destructive calls behind confirmation, or display safety badges automatically.

## Resources & Prompts

Beyond tools, the MCP exposes:

- **Resources** (`src/resources.ts`) — readable data via `resources/read`. Currently: `apps://list` (5-min cached), `apps://known` (env map), `vendor://profile`. These reduce tool-call chatter for routine reads.
- **Prompts** (`src/prompts.ts`) — named workflow templates via `prompts/get`. Currently: `monthly_kpi_summary`, `draft_review_response`, `customer_sen_lookup`, `promo_for_customer`. Each emits a user-side instruction that drives a coordinated sequence of tool calls.

## Out of scope

Two multipart binary endpoints are deliberately NOT exposed as MCP tools:

- `POST /rest/3/artifacts` (upload artifact binary)
- `POST /rest/3/assets/images/{imageType}` (upload listing image)

Both require `multipart/form-data` with binary payload. Driving binary uploads from an LLM stdio MCP is awkward — the LLM would need a local file path and the server would need a multipart serializer. Easy to add later if needed; for now, use the Marketplace partner UI for these uploads.

The URL-based artifact ingestion path **is** wired (`artifact_fetch_from_url`) — Atlassian fetches the binary from a public URL, which is much easier to orchestrate.

## File layout

```
src/
├─ server.ts                Tool registration entrypoint
├─ config.ts                Env loading + PRODUCT_ID_* discovery
├─ http-client.ts           Single base URL, Basic auth, 429 retry
└─ tools/
   ├─ _shared.ts            jsonResult, asQuery, REPORTING_BASE, PROMO_BASE, shared filter schemas
   └─ *.ts                  One file per Marketplace domain (25 files total)
```

Every tool file exports a single `register<Name>Tools(server)` function that calls `server.tool(name, description, schema, handler)` for each tool. The handler is a thin wrapper around `request()` plus a `jsonResult()` envelope. No business logic in tools — they're pure transport.

## Why no test suite?

The MCP is 95% thin HTTP wrappers. Mocking the live API would replicate the swagger and rot independently. The verification strategy is:

- TypeScript strict mode (compile-time)
- Live smoke tests via the stdio harness (`tools/list` + a handful of `tools/call` per phase)
- Coverage diff against the swagger (script in `/tmp/...` during initial build, not checked in)

If we later add **business logic** (caching, dedup, derived metrics) that warrants unit tests, we'd add Vitest. Until then, the 1700 lines of source carry no logic that a typecheck doesn't catch.
