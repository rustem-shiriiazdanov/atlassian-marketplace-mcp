import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Load .env from the process cwd first (highest dotenv precedence), then fall
// back to the repo root relative to this module (dist/config.js -> ../.env).
// MCP clients launch `node <abs-path>/dist/server.js` from an arbitrary
// working directory, so a cwd-only lookup would miss the repo's .env entirely.
// dotenv never overwrites already-set vars, so real environment variables and
// the cwd .env always win over the fallback.
loadEnv();
loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function loadKnownProductIds(): Record<string, string> {
  const out: Record<string, string> = {};
  const prefix = "PRODUCT_ID_";
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith(prefix) || !v) continue;
    const name = k.slice(prefix.length).toLowerCase();
    out[name] = v;
  }
  return out;
}

/**
 * Loaded credentials and IDs needed to talk to the Atlassian Marketplace vendor APIs.
 *
 * Populated at import time from `process.env` (with `dotenv` reading `.env` first).
 * Missing required vars throw immediately so the MCP server fails fast on
 * startup rather than mid-request.
 *
 * ## Required env vars
 *
 * | Var | Used for |
 * |---|---|
 * | `ATLASSIAN_EMAIL` | HTTP Basic auth user (the vendor account email). |
 * | `ATLASSIAN_API_TOKEN` | HTTP Basic auth password (a vendor API token from id.atlassian.com). |
 * | `MARKETPLACE_DEVELOPER_ID` | UUID-shaped developer-space ID; used in every `/rest/3/reporting/developer-space/{developerId}/...` path. |
 * | `MARKETPLACE_PARTNER_ID` | Numeric partner ID; used in every `/catalog/partners/{partnerId}/promotions/...` path. |
 *
 * ## Optional env vars
 *
 * - `PRODUCT_ID_<NAME>` — any var matching this prefix is loaded into
 *   `knownProductIds[<name>]` (lowercased key). Used by tools that need a
 *   product UUID. Example: `PRODUCT_ID_REPORT_BUILDER=12345abc-...` →
 *   `config.knownProductIds.report_builder`.
 * - `HTTP_TIMEOUT_MS`, `HTTP_MAX_ATTEMPTS`, `EXPORT_TIMEOUT_MS`,
 *   `MAX_RESPONSE_CHARS` — see `http-client.ts` / `_shared.ts`.
 *
 * @example Sample dotenv
 * ```sh
 * ATLASSIAN_EMAIL=you@vendor.com
 * ATLASSIAN_API_TOKEN=your_api_token_here
 * MARKETPLACE_DEVELOPER_ID=00000000-0000-0000-0000-000000000000
 * MARKETPLACE_PARTNER_ID=0000000
 * PRODUCT_ID_YOUR_APP=00000000-0000-0000-0000-000000000000
 * ```
 *
 * @example Reading it elsewhere
 * ```ts
 * import { config } from "./config.js";
 * const url = `${config.apiBase}/rest/3/reporting/developer-space/${config.developerId}/licenses`;
 * ```
 */
export const config = {
  email: required("ATLASSIAN_EMAIL"),
  apiToken: required("ATLASSIAN_API_TOKEN"),
  developerId: required("MARKETPLACE_DEVELOPER_ID"),
  partnerId: required("MARKETPLACE_PARTNER_ID"),
  apiBase: "https://api.atlassian.com/marketplace",
  knownProductIds: loadKnownProductIds(),
};
