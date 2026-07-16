#!/usr/bin/env node
/**
 * Regenerate docs/TOOLS.md from a live `tools/list` / `resources/list` /
 * `prompts/list` against the running MCP, augmented with per-tool spec URLs
 * from `TOOL_ENDPOINTS` (single source of truth).
 *
 * Run:  npm run docs:tools
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TOOL_ENDPOINTS, specUrl } from "../dist/tools/_spec-links.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, "..", "dist", "server.js");
const OUT = join(__dirname, "..", "docs", "TOOLS.md");

// ── Spawn server + drive MCP stdio ───────────────────────────────────────────
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
  clientInfo: { name: "gen-tools-md", version: "1.0" },
});
notify("notifications/initialized");

const tools = (await rpc("tools/list", {})).result.tools;
const resources = (await rpc("resources/list", {})).result.resources;
const prompts = (await rpc("prompts/list", {})).result.prompts;
child.kill();

// ── Section layout: longest-prefix wins ──────────────────────────────────────
const SECTIONS = [
  ["apps",                  "Apps discovery"],
  ["promotions",            "Promotions"],
  ["licenses",              "Licenses"],
  ["transactions",          "Transactions"],
  ["reporting_links",       "Reporting meta"],
  ["evaluations",           "Evaluations"],
  ["feedback",              "Feedback"],
  ["customer_insights",     "Customer insights"],
  ["metrics",               "Sales metrics"],
  ["benchmark",             "Benchmarks"],
  ["marketing_attribution", "Marketing attribution"],
  ["app_requests",          "App requests & approvals"],
  ["review",                "Reviews"],
  ["search_keywords",       "Search keywords"],
  ["zero_search",           "Search keywords — zero results"],
  ["free_starter",          "Free starter tier"],
  ["app_listing",           "App listing"],
  ["app_software",          "App software (versions, tokens)"],
  ["app_version_listing",   "App version listing"],
  ["privacy_security",      "Privacy & security"],
  ["cloud_migration",       "Cloud migration compatibility"],
  ["parent_software",       "Parent software"],
  ["developer_space",       "Developer space (admin)"],
  ["partner_metrics",       "Partner metrics"],
  ["product_catalog",       "Product catalog"],
  ["artifact",              "Artifacts"],
];
function sectionFor(name) {
  let best = "";
  for (const [p] of SECTIONS) if (name.startsWith(p) && p.length > best.length) best = p;
  return best;
}
const groups = {};
for (const t of tools) (groups[sectionFor(t.name)] ??= []).push(t);

function badge(t) {
  const a = t.annotations || {};
  if (a.destructiveHint) return " ⚠️ destructive";
  if (a.readOnlyHint) return "";
  return " 🔧 write-safe";
}
function ghAnchor(s) {
  return s.toLowerCase().replace(/—/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function mdClean(s) {
  if (!s) return "";
  return s.replace(/\n+/g, " ").replace(/\|/g, "\\|");
}

// ── Write ────────────────────────────────────────────────────────────────────
let out = "";
const today = new Date().toISOString().slice(0, 10);

out += `# Catalog: tools, resources, prompts\n\n`;
out += `Atlassian Marketplace MCP — **${tools.length} tools**, **${resources.length} resources**, **${prompts.length} prompts**. Generated from live MCP responses on ${today}.\n\n`;
out += `Conventions:\n\n`;
out += `- ⚠️ marks tools whose effects are publicly visible (customers, marketplace listing, other team members) or that create credentials. Mirrors \`annotations.destructiveHint\`.\n`;
out += `- 🔧 marks tools that perform writes but aren't destructive (e.g. starting an async export).\n`;
out += `- Other tools are read-only (\`annotations.readOnlyHint: true\`).\n`;
out += `- 📖 **Spec** column links to Atlassian's official docs for each endpoint (v4 docs site labels the modern API as v4 even though the wire path is \`/rest/3/...\`; promotions are v1 — see [ARCHITECTURE.md](ARCHITECTURE.md)).\n`;
out += `- All tools require the 4 base env vars (see [README](../README.md#configure)). Reporting tools also accept the shared filter set unless noted.\n`;
out += `- \`productId\` is the **product UUID**, not the app key. Use \`apps_list\` / \`apps_known\`.\n`;
out += `- Responses over ~50,000 chars are spilled to a tmp file; the tool result returns a summary + file pointer (\`_file\`).\n`;
out += `- Sync exports and async-export downloads use a **10-minute** per-request timeout (overridable via env \`EXPORT_TIMEOUT_MS\`). Other calls use 60s.\n\n`;

out += `## Table of contents\n\n`;
out += `- [Resources](#resources)\n- [Prompts](#prompts)\n- Tools:\n`;
for (const [p, t] of SECTIONS) {
  if (groups[p]) out += `  - [${t}](#${ghAnchor(t)}) (${groups[p].length})\n`;
}
out += "\n";

// Resources
out += `## Resources\n\nMCP Resources expose readable data without a tool call. Read them via \`resources/read\`.\n\n`;
out += `| URI | Description |\n|---|---|\n`;
for (const r of resources) out += `| \`${r.uri}\` | ${mdClean(r.description || "")} |\n`;
out += "\n";

// Prompts
out += `## Prompts\n\nMCP Prompts are canonical workflows invokable via \`prompts/get\`.\n\n`;
for (const p of prompts) {
  out += `### \`${p.name}\`\n\n`;
  if (p.description) out += p.description + "\n\n";
  const args = p.arguments || [];
  if (args.length) {
    out += `| Arg | Required | Description |\n|---|---|---|\n`;
    for (const a of args) out += `| \`${a.name}\` | ${a.required ? "yes" : "no"} | ${mdClean(a.description || "")} |\n`;
    out += "\n";
  }
}

// Per-section tools
const emitted = new Set();
for (const [prefix, title] of SECTIONS) {
  if (!groups[prefix] || emitted.has(prefix)) continue;
  emitted.add(prefix);
  out += `## ${title}\n\n`;
  for (const t of groups[prefix].slice().sort((a, b) => a.name.localeCompare(b.name))) {
    out += `### \`${t.name}\`${badge(t)}\n\n`;
    // 📖 Spec link, derived from TOOL_ENDPOINTS
    const ep = TOOL_ENDPOINTS[t.name];
    if (ep) {
      out += `**📖 Spec:** \`${ep.method} ${ep.path}\` — [docs](${specUrl(ep.method, ep.path)})\n\n`;
      if (ep.note) out += `> ${ep.note}\n\n`;
    }
    // Strip the auto-appended "📖 Spec (...)" tail from the runtime description
    // (it's already shown above); leaves the human prose intact.
    let desc = (t.description || "").trim();
    desc = desc.replace(/\n*📖 Spec \([^)]+\):\s*https?:\/\/\S+$/m, "").trim();
    if (desc) out += desc + "\n\n";
    const props = t.inputSchema?.properties || {};
    const required = new Set(t.inputSchema?.required || []);
    if (Object.keys(props).length) {
      out += `| Arg | Type | Required | Description |\n|---|---|---|---|\n`;
      for (const [arg, info] of Object.entries(props)) {
        let ty = info.type || "";
        if (info.enum) ty = `enum: ${info.enum.join(", ")}`;
        else if (info.anyOf) ty = info.anyOf.map((o) => o.type || "?").join(" \\| ");
        if (!ty) ty = "any";
        let d = mdClean(info.description || "");
        if (d.length > 200) d = d.slice(0, 197) + "...";
        out += `| \`${arg}\` | \`${ty}\` | ${required.has(arg) ? "yes" : "no"} | ${d} |\n`;
      }
      out += "\n";
    } else {
      out += "*(no args)*\n\n";
    }
  }
}

writeFileSync(OUT, out);
console.log(`wrote ${OUT} (${out.length} bytes, ${tools.length} tools)`);
