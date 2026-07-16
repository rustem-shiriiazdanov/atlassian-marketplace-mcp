#!/usr/bin/env node
/**
 * Generate per-tool reference markdown pages under `docs/tools/`.
 *
 * For each tool the running MCP exposes via `tools/list`, write a dedicated
 * page with:
 *   - title + safety badge (read-only / write-safe / destructive)
 *   - method + endpoint + spec link
 *   - human description (with the auto-appended "📖 Spec" tail stripped)
 *   - parameter table with FULL Zod-derived descriptions (no 200-char trunc)
 *   - sample JSON-RPC `tools/call` payload (with realistic placeholders)
 *   - a footer linking back to the catalog index
 *
 * Also updates `typedoc.json`'s `projectDocuments` array to include the
 * generated files (alongside the hand-written docs) so they appear in the
 * TypeDoc HTML as first-class pages.
 *
 * Run:  npm run docs:tool-pages
 */
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, readdirSync, unlinkSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TOOL_ENDPOINTS, specUrl } from "../dist/tools/_spec-links.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, "..", "dist", "server.js");
const OUT_DIR = join(__dirname, "..", "docs", "tools");
const TYPEDOC_JSON = join(__dirname, "..", "typedoc.json");

// ── Spawn MCP, fetch tool list (mirrors gen-tools-md.mjs) ────────────────────
const child = spawn("node", [SERVER], { stdio: ["pipe", "pipe", "pipe"] });
let buf = "";
const pending = new Map();
let nextId = 1;
child.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try {
      const m = JSON.parse(line);
      if (m.id !== undefined && pending.has(m.id)) {
        const r = pending.get(m.id);
        pending.delete(m.id);
        r(m);
      }
    } catch {}
  }
});
const rpc = (method, params) => {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
};
const notify = (method, params) =>
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");

await rpc("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "gen-tool-pages", version: "1.0" },
});
notify("notifications/initialized");

const tools = (await rpc("tools/list", {})).result.tools;
child.kill();

// ── Section grouping (copy-paste from gen-tools-md.mjs, kept in sync) ────────
const SECTIONS = [
  ["apps", "Apps discovery"],
  ["promotions", "Promotions"],
  ["licenses", "Licenses"],
  ["transactions", "Transactions"],
  ["reporting_links", "Reporting meta"],
  ["evaluations", "Evaluations"],
  ["feedback", "Feedback"],
  ["customer_insights", "Customer insights"],
  ["metrics", "Sales metrics"],
  ["benchmark", "Benchmarks"],
  ["marketing_attribution", "Marketing attribution"],
  ["app_requests", "App requests & approvals"],
  ["review", "Reviews"],
  ["search_keywords", "Search keywords"],
  ["zero_search", "Search keywords — zero results"],
  ["free_starter", "Free starter tier"],
  ["app_listing", "App listing"],
  ["app_software", "App software (versions, tokens)"],
  ["app_version_listing", "App version listing"],
  ["privacy_security", "Privacy & security"],
  ["cloud_migration", "Cloud migration compatibility"],
  ["parent_software", "Parent software"],
  ["developer_space", "Developer space (admin)"],
  ["partner_metrics", "Partner metrics"],
  ["product_catalog", "Product catalog"],
  ["artifact", "Artifacts"],
];
function sectionFor(name) {
  let best = "";
  let bestLabel = "Misc";
  for (const [p, label] of SECTIONS) {
    if (name.startsWith(p) && p.length > best.length) {
      best = p;
      bestLabel = label;
    }
  }
  return bestLabel;
}

function badge(t) {
  const a = t.annotations || {};
  if (a.destructiveHint) return "⚠️ **destructive** — visible side effects on customers / marketplace / team. Use with care.";
  if (a.readOnlyHint) return "🟢 **read-only** — safe to call freely; no side effects.";
  return "🔧 **write-safe** — writes (e.g. enqueues an async job or creates a vendor-internal record), no public-facing effect.";
}

// Realistic example value per arg name + type. The point isn't accuracy;
// it's to give a copy-pasteable starting payload that won't be rejected by Zod
// type validation. Real-world values come from the user.
function exampleValueFor(argName, info) {
  const enums = info.enum;
  if (enums?.length) return enums[0];
  const name = argName.toLowerCase();
  if (name.includes("date") || name.includes("startdate") || name.includes("enddate")) return "2026-05-01";
  if (name.includes("limit")) return 10;
  if (name.includes("offset")) return 0;
  if (name.includes("cursor")) return "";
  if (name === "exportid") return "export-id-from-async-start";
  if (name === "productid") return "<product-uuid-from-apps_list>";
  if (name === "appkey") return "your.app.key";
  if (name === "promotionid") return 0;
  if (name === "promotioncode") return "VN5U6M";
  if (name === "reviewid") return 0;
  if (name === "vendorid") return 0;
  if (name === "parentsoftwareid") return 0;
  if (name === "appsoftwareid") return 0;
  if (name === "softwareversionid") return 0;
  if (name === "metric") return "month";
  if (name === "tier") return 25;
  if (name === "country") return "US";
  if (name === "hosting") return "cloud";
  if (name === "sourcekey") return "marketplace";
  if (info.anyOf) {
    const first = info.anyOf[0];
    if (first?.type === "string") return "";
    if (first?.type === "number" || first?.type === "integer") return 0;
    if (first?.type === "boolean") return false;
    return null;
  }
  switch (info.type) {
    case "string": return "";
    case "number":
    case "integer": return 0;
    case "boolean": return false;
    case "array": return [];
    case "object": return {};
    default: return null;
  }
}

function escapeMdCell(s) {
  if (!s) return "";
  return String(s).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function pageFor(t) {
  const ep = TOOL_ENDPOINTS[t.name];
  const sect = sectionFor(t.name);

  // Strip the auto-appended "📖 Spec (...)" tail from the runtime description.
  let desc = (t.description || "").trim();
  desc = desc.replace(/\n*📖 Spec \([^)]+\):\s*https?:\/\/\S+$/m, "").trim();

  const props = t.inputSchema?.properties || {};
  const required = new Set(t.inputSchema?.required || []);
  const propEntries = Object.entries(props);

  // Build the example payload (only includes required props, plus the first
  // optional one to demonstrate shape).
  const exampleArgs = {};
  for (const [k, info] of propEntries) {
    if (required.has(k)) exampleArgs[k] = exampleValueFor(k, info);
  }
  // Add one optional for flavor.
  const firstOptional = propEntries.find(([k]) => !required.has(k));
  if (firstOptional && Object.keys(exampleArgs).length < 3) {
    exampleArgs[firstOptional[0]] = exampleValueFor(firstOptional[0], firstOptional[1]);
  }

  const lines = [];
  // YAML frontmatter — TypeDoc respects `title` and renders `group`/`category`
  // into the sidebar. Group all per-tool pages under "Tool reference — <section>".
  lines.push("---");
  lines.push(`title: ${t.name}`);
  lines.push(`group: Tool reference — ${sect}`);
  lines.push("---");
  lines.push("");
  lines.push(`# \`${t.name}\``);
  lines.push("");
  lines.push(badge(t));
  lines.push("");
  if (ep) {
    lines.push(`**📖 Spec:** \`${ep.method} ${ep.path}\` — [Atlassian docs](${specUrl(ep.method, ep.path)})`);
    lines.push("");
    if (ep.note) {
      lines.push(`> **Note:** ${ep.note}`);
      lines.push("");
    }
  }
  if (desc) {
    lines.push("## Description");
    lines.push("");
    lines.push(desc);
    lines.push("");
  }
  lines.push("## Parameters");
  lines.push("");
  if (propEntries.length === 0) {
    lines.push("*(none)*");
    lines.push("");
  } else {
    lines.push("| Name | Type | Required | Description |");
    lines.push("|---|---|---|---|");
    for (const [name, info] of propEntries) {
      let ty = info.type || "";
      if (info.enum) ty = `enum: ${info.enum.map((e) => `\`${e}\``).join(" \\| ")}`;
      else if (info.anyOf) ty = info.anyOf.map((o) => `\`${o.type || "?"}\``).join(" \\| ");
      else if (ty) ty = `\`${ty}\``;
      if (!ty) ty = "`any`";
      lines.push(`| \`${name}\` | ${ty} | ${required.has(name) ? "yes" : "no"} | ${escapeMdCell(info.description || "")} |`);
    }
    lines.push("");
  }
  lines.push("## Example MCP call");
  lines.push("");
  lines.push("JSON-RPC payload over stdio:");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: t.name, arguments: exampleArgs },
  }, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## See also");
  lines.push("");
  lines.push(`- [Full tool catalog](../TOOLS.md)`);
  lines.push(`- [Architecture notes](../ARCHITECTURE.md)`);
  if (ep) lines.push(`- [Atlassian spec](${specUrl(ep.method, ep.path)})`);
  lines.push("");

  return lines.join("\n");
}

// ── Wipe + regenerate the docs/tools/ directory ──────────────────────────────
try {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const f of readdirSync(OUT_DIR)) {
    if (f.endsWith(".md")) unlinkSync(join(OUT_DIR, f));
  }
} catch {}

let count = 0;
for (const t of tools) {
  writeFileSync(join(OUT_DIR, `${t.name}.md`), pageFor(t));
  count++;
}

// ── Update typedoc.json's projectDocuments ────────────────────────────────────
// We keep the hand-written docs first, then append all per-tool pages.
const HAND_WRITTEN = [
  "docs/TOOLS.md",
  "docs/ARCHITECTURE.md",
  "docs/TESTING.md",
  "docs/CHANGELOG.md",
];
const cfg = JSON.parse(readFileSync(TYPEDOC_JSON, "utf-8"));
cfg.projectDocuments = [
  ...HAND_WRITTEN,
  ...tools.map((t) => `docs/tools/${t.name}.md`).sort(),
];
writeFileSync(TYPEDOC_JSON, JSON.stringify(cfg, null, 2) + "\n");

console.log(`wrote ${count} per-tool page(s) to ${OUT_DIR}/`);
console.log(`updated ${TYPEDOC_JSON} — projectDocuments now lists ${cfg.projectDocuments.length} files`);
