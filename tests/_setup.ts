/**
 * Global vitest setup. Runs once before any test file imports.
 *
 * Loads `.env` if present so integration tests get real creds.
 * For unit/contract tests, npm scripts inject sentinel values BEFORE this
 * file runs, so `src/config.ts`'s `required()` checks pass without a real .env.
 */
import "dotenv/config";
import { afterAll } from "vitest";
import { readdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Truncation tests (large responses) spill to `${tmpdir()}/atlassian-mcp-*`.
// On constrained CI / sandbox temp quotas these accumulate across runs and can
// fill the disk. Sweep them after each test file so repeated runs stay bounded.
afterAll(() => {
  try {
    const dir = tmpdir();
    for (const f of readdirSync(dir)) {
      if (f.startsWith("atlassian-mcp-")) {
        try { unlinkSync(join(dir, f)); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
});
