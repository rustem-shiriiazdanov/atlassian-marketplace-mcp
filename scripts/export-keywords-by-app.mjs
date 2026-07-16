#!/usr/bin/env node
/**
 * Per-app search-keyword export, monthly, across all available history → one CSV
 * under ./downloads/.
 *
 * Drives the MCP over stdio: discovers apps via `apps_list`, then calls
 * `search_keywords_by_app` (aggregation=month) once per app. Each call returns
 * every keyword's monthly time-series, which we flatten to long format.
 * Runs the server with MAX_RESPONSE_CHARS=0 so each app's payload returns inline.
 *
 * Output columns: addonName, addonKey, productId, rank, searchKeyword,
 *                 keywordTotal, year, month, count
 *   (one row per app×keyword×month where count > 0; `rank` = keyword's position
 *    within the app by total count; `keywordTotal` = its all-time total.)
 *
 * Usage: node scripts/export-keywords-by-app.mjs [startYYYY-MM-DD] [endYYYY-MM-DD]
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SERVER = join(ROOT, "dist", "server.js");
const OUT_DIR = join(ROOT, "downloads");

const now = new Date();
const START = process.argv[2] || "2022-01-01";
const END = process.argv[3] || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

// ── MCP stdio client ─────────────────────────────────────────────────────────
const child = spawn("node", [SERVER], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env, MAX_RESPONSE_CHARS: "0" },
});
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
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    } catch { /* ignore */ }
  }
});
const rpc = (method, params) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
});
async function callTool(name, args) {
  const r = await rpc("tools/call", { name, arguments: args });
  const text = r.result?.content?.[0]?.text ?? "";
  if (r.result?.isError) throw new Error(`${name}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}
const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

// ── run ────────────────────────────────────────────────────────────────────────
await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "export-keywords-by-app", version: "1.0" } });
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

const appsResp = await callTool("apps_list", {});
const apps = appsResp.apps ?? [];
process.stderr.write(`Discovered ${apps.length} apps\n`);

mkdirSync(OUT_DIR, { recursive: true });
const rows = [["addonName", "addonKey", "productId", "rank", "searchKeyword", "keywordTotal", "year", "month", "count"]];
let totalRows = 0, appsWithData = 0;

for (const app of apps) {
  let data;
  try {
    data = await callTool("search_keywords_by_app", {
      productId: app.productId, startDate: START, endDate: END, aggregation: "month",
    });
  } catch (e) {
    process.stderr.write(`  ${app.appKey}: ERROR ${e.message}\n`);
    continue;
  }
  const details = data.details ?? [];
  if (details.length === 0) { process.stderr.write(`  ${app.appKey}: (no keywords)\n`); continue; }
  const addonName = data.summary?.addonName ?? app.appName ?? "";
  const addonKey = data.summary?.addonKey ?? app.appKey ?? "";
  appsWithData++;
  let appRowCount = 0;
  details.forEach((kw, idx) => {
    const rank = idx + 1; // details are ordered by total count desc
    for (const el of kw.elements ?? []) {
      if (!el.count) continue; // skip zero-count months
      const [year, month] = el.date.split("-"); // YYYY-MM-01
      rows.push([csvCell(addonName), addonKey, app.productId, rank, csvCell(kw.searchKeyword), kw.keywordCount, year, month, el.count]);
      appRowCount++; totalRows++;
    }
  });
  process.stderr.write(`  ${addonKey}: ${details.length} keywords → ${appRowCount} month-rows\n`);
}

const csv = rows.map((r) => r.join(",")).join("\n") + "\n";
const outFile = join(OUT_DIR, "search-keywords-by-app-monthly.csv");
writeFileSync(outFile, csv, "utf-8");
child.kill();

console.log(`\n✓ ${appsWithData} apps with keyword data, ${totalRows} app×keyword×month rows`);
console.log(`✓ wrote ${outFile} (${csv.length} bytes)`);
