#!/usr/bin/env node
/**
 * Codemod: for each `src/tools/*.ts` file, regenerate the TSDoc comment that
 * sits directly above `export function register*Tools(...)`. The comment
 * gets a per-file endpoint table sourced from `TOOL_ENDPOINTS`, so the
 * developer-facing TypeDoc HTML always shows what the file actually wraps.
 *
 * Idempotent: re-run after adding/renaming tools to refresh the tables.
 *
 * Run:  npm run docs:tsdoc
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TOOL_ENDPOINTS, specUrl } from "../dist/tools/_spec-links.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = join(__dirname, "..", "src", "tools");

const files = readdirSync(TOOLS_DIR)
  .filter((f) => f.endsWith(".ts") && !f.startsWith("_") && f !== "apps.ts" /* example handled separately */ || f === "apps.ts");

// Marker so we can re-find and replace the auto-generated block on subsequent runs.
const BEGIN = "// <auto-tsdoc-begin>";
const END = "// <auto-tsdoc-end>";

/**
 * Some files don't expose tool names via a direct `server.tool("name", …)` call
 * (e.g., a helper function wraps the registration with the name passed as an arg).
 * Hardcode the tool list for those files here.
 */
const FILE_TOOLS_OVERRIDE = {
  "customer-insights.ts": [
    "customer_insights_regions",
    "customer_insights_editions",
    "customer_insights_tiers",
    "customer_insights_active_users",
  ],
};

function tsdocFor(file, fnName, tools) {
  const lines = [];
  lines.push(`${BEGIN}`);
  lines.push(`/**`);
  lines.push(` * Tool group registered from \`${file}\` (${tools.length} tool${tools.length === 1 ? "" : "s"}).`);
  lines.push(` *`);
  lines.push(` * Auto-generated from \`TOOL_ENDPOINTS\` (in \`_spec-links.ts\`). Re-run`);
  lines.push(` * \`npm run docs:tsdoc\` after adding/renaming tools to refresh.`);
  lines.push(` *`);
  lines.push(` * | Tool | Method | Endpoint | Docs |`);
  lines.push(` * |---|---|---|---|`);
  for (const name of tools) {
    const ep = TOOL_ENDPOINTS[name];
    if (!ep) {
      lines.push(` * | \`${name}\` | — | _(not mapped in TOOL_ENDPOINTS)_ | — |`);
      continue;
    }
    const url = specUrl(ep.method, ep.path);
    lines.push(` * | \`${name}\` | \`${ep.method}\` | \`${ep.path}\` | [docs](${url}) |`);
  }
  lines.push(` *`);
  lines.push(` * @param server  Active MCP server. Each tool below becomes callable via`);
  lines.push(` *   the JSON-RPC \`tools/call\` method immediately after this function returns.`);
  lines.push(` *   Tools carry MCP annotations (\`readOnlyHint\`, \`destructiveHint\`,`);
  lines.push(` *   \`idempotentHint\`) from the \`READ_ONLY\` / \`WRITE_SAFE\` / \`DESTRUCTIVE\``);
  lines.push(` *   constants in \`_shared.ts\` so clients can reason about safety up front.`);
  lines.push(` *`);
  lines.push(` * @returns \`void\`. The function's effect is **registration as a side effect**`);
  lines.push(` *   on \`server\` — the listed tools (${tools.map((t) => `\`${t}\``).join(", ")}) become live.`);
  lines.push(` *   Each tool's input is validated by a Zod schema before its handler runs;`);
  lines.push(` *   handler output is wrapped through \`jsonResult()\` which auto-spills`);
  lines.push(` *   payloads larger than \`MAX_RESPONSE_CHARS\` (default 50k) to a tmp file.`);
  lines.push(` *`);
  lines.push(` * @example`);
  lines.push(` * \`\`\`ts`);
  lines.push(` * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";`);
  lines.push(` * import { ${fnName} } from "./tools/${file.replace(/\.ts$/, "")}.js";`);
  lines.push(` *`);
  lines.push(` * const server = new McpServer({ name: "atlassian-marketplace-mcp", version: "0.3.0" });`);
  lines.push(` * ${fnName}(server);`);
  lines.push(` * // Now ${tools.length === 1 ? "this tool is" : "these tools are"} live: ${tools.slice(0, 3).map((t) => `\`${t}\``).join(", ")}${tools.length > 3 ? ", …" : ""}`);
  lines.push(` * \`\`\``);
  lines.push(` *`);
  lines.push(` * @see [Marketplace REST docs](https://developer.atlassian.com/platform/marketplace/rest/v4/) — Atlassian's site labels the modern API as \`/v4/\` even though the wire URL paths are \`/rest/3/...\`. Promotion endpoints are v1.`);
  lines.push(` */`);
  lines.push(`${END}`);
  return lines.join("\n");
}

let totalUpdated = 0;
for (const f of files) {
  const path = join(TOOLS_DIR, f);
  let src = readFileSync(path, "utf-8");
  // Find tool names in this file (look for server.tool("name", ...)).
  let toolNames = [...src.matchAll(/server\.tool\(\s*"([^"]+)"/g)].map((m) => m[1]);
  if (FILE_TOOLS_OVERRIDE[f]) toolNames = FILE_TOOLS_OVERRIDE[f];
  if (toolNames.length === 0) {
    console.warn(`  ${f}: no tool names found (no direct server.tool() calls and no override) — skipping`);
    continue;
  }

  // Locate the export function declaration line.
  const fnMatch = src.match(/export function (register\w+Tools)\(server: McpServer\): void \{/);
  if (!fnMatch) {
    console.warn(`  ${f}: no register*Tools function found — skipping`);
    continue;
  }
  const fnName = fnMatch[1];
  const fnStart = fnMatch.index;

  // Build the new auto-block.
  const block = tsdocFor(f, fnName, toolNames);

  // If a previous auto-block exists, replace it; else insert before the function.
  const reAuto = new RegExp(`${BEGIN}[\\s\\S]*?${END}\\n*`, "m");
  if (reAuto.test(src)) {
    src = src.replace(reAuto, block + "\n");
  } else {
    // Insert before any existing hand-written TSDoc block (which is the comment
    // immediately preceding the function declaration), or directly before the
    // function if no comment exists.
    // We always place the auto-block BEFORE the export so it stays close to it.
    const before = src.slice(0, fnStart);
    const after = src.slice(fnStart);
    // Strip trailing newlines from `before` (we re-add a clean separation).
    src = before.replace(/\n+$/, "") + "\n\n" + block + "\n" + after;
  }

  writeFileSync(path, src);
  console.log(`  ✓ ${f}: ${toolNames.length} tool(s) → table injected`);
  totalUpdated++;
}
console.log(`\nUpdated ${totalUpdated} file(s).`);
