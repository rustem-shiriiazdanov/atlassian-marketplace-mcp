#!/usr/bin/env node
/**
 * Export top-500 marketplace search keywords PER MONTH across all available
 * history, into a single CSV under ./downloads/.
 *
 * Drives the MCP server over stdio (the same transport a real client uses) and
 * calls `search_keywords_by_source_export` once per month. Runs the server with
 * MAX_RESPONSE_CHARS=0 so every monthly export returns inline (no tmp-file spill).
 *
 * Output columns: year, month, rank, searchKeyword, percentage
 *
 * Usage:  node scripts/export-keywords-by-month.mjs [startYYYY-MM] [endYYYY-MM]
 *   defaults: 2021-01 .. current month
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SERVER = join(ROOT, "dist", "server.js");
const OUT_DIR = join(ROOT, "downloads");
const SOURCE = "marketplace";

// ── args / month range ───────────────────────────────────────────────────────
function parseYM(s, fallback) {
  if (!s) return fallback;
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`bad month: ${s} (want YYYY-MM)`);
  return { y: +m[1], m: +m[2] };
}
const now = new Date();
const start = parseYM(process.argv[2], { y: 2021, m: 1 });
const end = parseYM(process.argv[3], { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 });

function* months(a, b) {
  let y = a.y, m = a.m;
  while (y < b.y || (y === b.y && m <= b.m)) {
    yield { y, m };
    if (++m > 12) { m = 1; y++; }
  }
}
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based
const pad = (n) => String(n).padStart(2, "0");

// ── MCP stdio client ───────────────────────────────────────────────────────────
const child = spawn("node", [SERVER], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env, MAX_RESPONSE_CHARS: "0" }, // disable truncation → inline
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
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch { /* ignore non-JSON */ }
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
  if (r.result?.isError) throw new Error(`tool ${name} error: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── run ──────────────────────────────────────────────────────────────────────
await rpc("initialize", {
  protocolVersion: "2024-11-05", capabilities: {},
  clientInfo: { name: "export-keywords-by-month", version: "1.0" },
});
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

mkdirSync(OUT_DIR, { recursive: true });
const rows = [["year", "month", "rank", "searchKeyword", "percentage"]];
let monthsWithData = 0, totalRows = 0;

for (const { y, m } of months(start, end)) {
  const startDate = `${y}-${pad(m)}-01`;
  const endDate = `${y}-${pad(m)}-${pad(lastDay(y, m))}`;
  let data;
  try {
    data = await callTool("search_keywords_by_source_export", { sourceKey: SOURCE, startDate, endDate });
  } catch (e) {
    process.stderr.write(`  ${y}-${pad(m)}: ERROR ${e.message}\n`);
    continue;
  }
  const list = Array.isArray(data) ? data : [];
  if (list.length === 0) { process.stderr.write(`  ${y}-${pad(m)}: (no data)\n`); continue; }
  monthsWithData++;
  list.forEach((r, idx) => {
    rows.push([y, pad(m), idx + 1, csvCell(r.searchKeyword), r.percentage]);
    totalRows++;
  });
  process.stderr.write(`  ${y}-${pad(m)}: ${list.length} keywords\n`);
}

const csv = rows.map((r) => r.join(",")).join("\n") + "\n";
const outFile = join(OUT_DIR, "search-keywords-by-month.csv");
writeFileSync(outFile, csv, "utf-8");
child.kill();

console.log(`\n✓ ${monthsWithData} months with data, ${totalRows} keyword-rows`);
console.log(`✓ wrote ${outFile} (${csv.length} bytes)`);
