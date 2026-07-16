import { config } from "./config.js";

/**
 * Inputs for {@link request}. Mirrors the Atlassian REST conventions:
 *
 * - `path` is the URL fragment after `apiBase` (typically starts with `/rest/3/...`).
 *   The base URL is `https://api.atlassian.com/marketplace` so a fully qualified
 *   URL would be `${apiBase}${path}`.
 * - `query` values are coerced via `String(v)`; `undefined`/`null` entries are
 *   dropped (so callers can spread optional filters without guarding each one).
 *   Repeated keys are NOT supported — set `URLSearchParams` manually if needed.
 * - `body` is JSON-stringified when defined; `Content-Type: application/json`
 *   is set automatically.
 * - `accept` defaults to `application/json`. Use `text/csv` for sync exports.
 *
 * @example
 * ```ts
 * // GET /rest/3/reporting/.../licenses?text=SEN-123&limit=10
 * const data = await request({
 *   path: `${REPORTING_BASE}/licenses`,
 *   query: { text: "SEN-123", limit: 10 },
 * });
 *
 * // POST with body
 * const result = await request({
 *   method: "POST",
 *   path: `${PROMO_BASE}`,
 *   body: { name: "Demo", discountPercent: 1 },
 * });
 *
 * // Long-running CSV export with bumped timeout
 * const csv = await request<string>({
 *   path: `${REPORTING_BASE}/licenses/export`,
 *   accept: "text/csv",
 *   timeoutMs: EXPORT_TIMEOUT_MS, // 10 minutes
 * });
 * ```
 */
export interface RequestOptions {
  /** HTTP method. Defaults to `GET`. */
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** URL path appended to `config.apiBase`. Typically starts with `/rest/3/...`. */
  path: string;
  /** Query string params. `undefined`/`null` values are dropped. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Request body. JSON-stringified automatically when defined. */
  body?: unknown;
  /** Response Accept header. Defaults to `application/json`. */
  accept?: string;
  /**
   * Override the default per-request timeout (60s default; configurable via
   * `HTTP_TIMEOUT_MS` env). Used by sync exports and async-export downloads
   * where the response body itself can take minutes to stream.
   */
  timeoutMs?: number;
}

const MAX_ATTEMPTS = Number(process.env.HTTP_MAX_ATTEMPTS ?? 4);
const DEFAULT_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS ?? 60_000);
const BACKOFF_CAP_MS = 10_000;

function basicAuthHeader(): string {
  const token = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  return `Basic ${token}`;
}

function buildUrl({ path, query }: { path: string; query?: RequestOptions["query"] }): string {
  const url = new URL(`${config.apiBase}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Returns wait time in ms for a retryable response (429 or transient 5xx).
// Honors Retry-After when present; otherwise exponential backoff capped at 10s.
function retryDelayMs(res: Response, attempt: number): number {
  const ra = res.headers.get("Retry-After");
  if (ra) {
    const n = Number(ra);
    if (Number.isFinite(n) && n > 0) return Math.min(n * 1000, BACKOFF_CAP_MS);
  }
  return Math.min(2 ** attempt * 1000, BACKOFF_CAP_MS);
}

function isRetryableStatus(status: number): boolean {
  // 429 (rate-limited), 502 (bad gateway), 503 (service unavailable), 504 (gateway timeout)
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Authenticated HTTP request to the Atlassian Marketplace API with retry,
 * exponential backoff, and per-request timeout.
 *
 * Resilience built in:
 * - **Auth**: HTTP Basic from `config.email` + `config.apiToken`.
 * - **Retry**: up to `HTTP_MAX_ATTEMPTS` (default 4) for `429`, `502`, `503`, `504`.
 *   Honors `Retry-After` when present; else exponential backoff capped at 10s.
 * - **Timeout**: `AbortController`-based; default 60s, override via `opts.timeoutMs`.
 * - **Truncation**: handled downstream by `jsonResult()` in `tools/_shared.ts`, not here.
 *
 * Throws an `Error` with the upstream status + body on non-retryable failures
 * and after the final retry of a retryable failure.
 *
 * @template T  Expected response shape. Defaults to `unknown` — pass an explicit
 *   type when you know the JSON shape, or `string` when `accept` is `text/csv`.
 * @param opts  See {@link RequestOptions}.
 * @returns Parsed JSON (for `application/json`) or raw text (otherwise).
 *
 * @example
 * ```ts
 * // Returns: { items: [...], _links: {...} }
 * type ListLicensesResp = { items: License[]; _links: { next?: string } };
 * const page = await request<ListLicensesResp>({
 *   path: `${REPORTING_BASE}/licenses`,
 *   query: { startDate: "2026-05-01", limit: 50 },
 * });
 * ```
 */
export async function request<T = unknown>(opts: RequestOptions): Promise<T> {
  const { method = "GET", body, accept = "application/json" } = opts;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = buildUrl(opts);

  const headers: Record<string, string> = {
    Authorization: basicAuthHeader(),
    Accept: accept,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let attempt = 0;
  let lastError: Error | null = null;
  while (attempt < MAX_ATTEMPTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = (err as Error)?.name === "AbortError";
      const msg = aborted
        ? `Request timeout after ${timeoutMs}ms: ${method} ${url}`
        : `Network error: ${method} ${url}: ${(err as Error)?.message}`;
      lastError = new Error(msg);
      // Treat timeouts and network errors as transient; back off and retry.
      attempt++;
      if (attempt >= MAX_ATTEMPTS) throw lastError;
      await sleep(Math.min(2 ** attempt * 1000, BACKOFF_CAP_MS));
      continue;
    }
    clearTimeout(timer);

    if (isRetryableStatus(res.status) && attempt < MAX_ATTEMPTS - 1) {
      const wait = retryDelayMs(res, attempt);
      attempt++;
      await sleep(wait);
      continue;
    }

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${method} ${url}: ${text.slice(0, 500)}`);
    }

    if (accept !== "application/json") {
      return text as unknown as T;
    }
    if (!text) return undefined as unknown as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }
  throw lastError ?? new Error(`Exhausted ${MAX_ATTEMPTS} attempts for ${method} ${url}`);
}
