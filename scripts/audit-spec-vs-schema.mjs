#!/usr/bin/env node
/**
 * Spec-vs-schema audit. For every tool in TOOL_ENDPOINTS, compare the live MCP
 * input schema against the documented parameters in the OpenAPI spec
 * (swagger.marketplace.v3.txt). Flags:
 *   - MISSING: a spec query/path param our schema doesn't expose (e.g. `accept`)
 *   - EXTRA:   a schema prop the spec doesn't document (may be intentional —
 *              an undocumented-but-working filter — or a stale leftover)
 *
 * Read-only / advisory. Run: node scripts/audit-spec-vs-schema.mjs [pathToSwagger]
 */
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TOOL_ENDPOINTS } from "../dist/tools/_spec-links.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, "..", "dist", "server.js");
// Path to the OpenAPI spec. Pass as arg 1, or set SWAGGER_PATH, else look for
// `swagger.marketplace.v3.txt` in CWD or ~/Downloads.
const SWAGGER = process.argv[2]
  || process.env.SWAGGER_PATH
  || (existsSync("swagger.marketplace.v3.txt")
      ? "swagger.marketplace.v3.txt"
      : join(process.env.HOME ?? ".", "Downloads", "swagger.marketplace.v3.txt"));

const spec = JSON.parse(readFileSync(SWAGGER, "utf-8"));
const compParams = spec.components?.parameters ?? {};

// spec path → set of {name, in, enum}
function specParamsFor(method, path) {
  // swagger paths use the same shape as TOOL_ENDPOINTS.path
  const pathObj = spec.paths[path];
  if (!pathObj) return null;
  const op = pathObj[method.toLowerCase()];
  if (!op) return null;
  const out = [];
  for (const pr of op.parameters ?? []) {
    let nm, loc, enumv;
    if (pr.$ref) {
      const c = compParams[pr.$ref.split("/").pop()] ?? {};
      nm = c.name; loc = c.in; enumv = c.schema?.enum;
    } else {
      nm = pr.name; loc = pr.in; enumv = pr.schema?.enum;
    }
    if (nm) out.push({ name: nm, in: loc, enum: enumv });
  }
  return out;
}

// ── live MCP schemas ───────────────────────────────────────────────────────────
const child = spawn("node", [SERVER], { stdio: ["pipe", "pipe", "inherit"] });
let buf = ""; const pending = new Map(); let nextId = 1;
child.stdout.on("data", (c) => {
  buf += c.toString(); let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    try { const m = JSON.parse(line); if (m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } } catch {}
  }
});
const rpc = (method, params) => new Promise((r) => { const id = nextId++; pending.set(id, r); child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });

await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "audit", version: "1" } });
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
const tools = (await rpc("tools/list", {})).result.tools;
child.kill();
const schemaProps = Object.fromEntries(tools.map((t) => [t.name, Object.keys(t.inputSchema?.properties ?? {})]));

// path-param names that we intentionally don't always mirror 1:1
const ALWAYS_PATH = new Set(["developerId", "partnerId", "imageType"]); // injected from config / not user args

// Tools that reuse an endpoint's TOOL_ENDPOINTS entry but don't proxy its query
// params — comparing them to the spec is a false positive. `apps_known` is a
// static env-var lookup that shares apps_list's endpoint only for the docs URL.
const NOT_A_PROXY = new Set(["apps_known"]);

let missingTotal = 0, noSpec = 0;
const report = [];
for (const [name, ep] of Object.entries(TOOL_ENDPOINTS)) {
  if (NOT_A_PROXY.has(name)) continue;
  const sp = specParamsFor(ep.method, ep.path);
  const props = new Set(schemaProps[name] ?? []);
  if (!sp) { noSpec++; report.push(`  ? ${name}: no spec entry for ${ep.method} ${ep.path}`); continue; }
  const specNames = sp.filter((p) => !ALWAYS_PATH.has(p.name)).map((p) => p.name);
  const missing = specNames.filter((n) => !props.has(n));
  const extra = [...props].filter((n) => !specNames.includes(n));
  if (missing.length) {
    missingTotal += missing.length;
    const detail = missing.map((n) => {
      const p = sp.find((x) => x.name === n);
      return `${n}[${p.in}]${p.enum ? `=${p.enum.join("|")}` : ""}`;
    });
    report.push(`  ⚠ ${name}: MISSING ${detail.join(", ")}` + (extra.length ? `  (extra in schema: ${extra.join(", ")})` : ""));
  }
}

console.log(`\nSpec-vs-schema audit — ${Object.keys(TOOL_ENDPOINTS).length} tools\n`);
if (report.length) report.forEach((l) => console.log(l));
else console.log("  ✅ every tool exposes all documented spec params");
console.log(`\n${missingTotal} missing-param findings across ${report.filter((r) => r.includes("MISSING")).length} tools; ${noSpec} tools had no spec entry (v1 promotions / non-reporting).`);
