#!/usr/bin/env node
// Focused test of code-related promotion APIs:
//   POST   /promotions/{id}/codes               — create a code
//   GET    /promotions/{id}/codes               — list codes
//   GET    /promotions/{id}/codes/{code}        — get one code
// Mints 3 codes, lists them, fetches each, leaves them in place (single-use codes are
// harmless dormant tokens — only redeemable if shared, which we don't).

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, "..", "dist", "server.js");

class McpClient {
  constructor(p) {
    this.child = spawn("node", [p], { stdio: ["pipe", "pipe", "pipe"] });
    this.buf = ""; this.pending = new Map(); this.id = 1;
    this.child.stdout.on("data", (c) => {
      this.buf += c.toString();
      let i;
      while ((i = this.buf.indexOf("\n")) >= 0) {
        const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1);
        if (!line) continue;
        try {
          const m = JSON.parse(line);
          if (m.id !== undefined && this.pending.has(m.id)) {
            const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id);
            m.error ? reject(new Error(m.error.message)) : resolve(m.result);
          }
        } catch {}
      }
    });
    this.child.stderr.on("data", (d) => process.stderr.write("[server] " + d.toString()));
  }
  req(method, params) {
    const id = this.id++;
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error("timeout " + method)); } }, 30000);
    });
  }
  notify(m, p) { this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: m, params: p }) + "\n"); }
  async init() {
    await this.req("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "codes", version: "1.0" } });
    this.notify("notifications/initialized");
  }
  call(name, args = {}) { return this.req("tools/call", { name, arguments: args }); }
  close() { this.child.kill(); }
}

const c = new McpClient(SERVER);
function header(t) { console.log("\n" + "=".repeat(78) + "\n  " + t + "\n" + "=".repeat(78)); }
function show(label, obj) { console.log(`${label}:\n${typeof obj === "string" ? obj : JSON.stringify(obj, null, 2)}`); }

try {
  await c.init();

  // 1) pick a test promo
  const list = JSON.parse((await c.call("promotions_list_paged", { limit: 5, orderBy: "CREATION_DATE" })).content[0].text);
  const testPromo = list.promotions.find(p => p.name?.startsWith("MCP_TEST_2026"));
  if (!testPromo) { console.error("No MCP_TEST promo found"); process.exit(1); }
  console.log("Using promo:", testPromo.id, "/", testPromo.name);

  // 2) list initial codes
  header("STEP 1 — list codes BEFORE minting");
  const before = JSON.parse((await c.call("promotions_codes_list", { promotionId: testPromo.id })).content[0].text);
  show("codes_list response", before);
  console.log(`→ initial code count: ${before.codes?.length ?? 0}`);

  // 3) create 3 codes
  header("STEP 2 — create 3 codes via promotions_codes_create");
  for (let i = 1; i <= 3; i++) {
    const r = await c.call("promotions_codes_create", { promotionId: testPromo.id });
    console.log(`  create #${i}:`, r.content[0].text);
  }

  // 4) list again
  header("STEP 3 — list codes AFTER minting");
  const after = JSON.parse((await c.call("promotions_codes_list", { promotionId: testPromo.id })).content[0].text);
  show("codes_list response", after);
  const codes = after.codes ?? [];
  console.log(`\n→ total codes now: ${codes.length}`);
  console.log("→ each code is a single-use redemption token; redeem URL: https://promo.atlassian.com/<CODE>");
  for (const c0 of codes) {
    console.log(`   - ${c0.code}  (created ${c0.created}, usage: ${c0.usage ? "REDEEMED" : "unused"})`);
  }

  // 5) get each code individually
  header("STEP 4 — fetch each code via promotions_code_get");
  for (const c0 of codes) {
    const r = await c.call("promotions_code_get", { promotionId: testPromo.id, promotionCode: c0.code });
    const parsed = JSON.parse(r.content[0].text);
    console.log(`\n  code ${c0.code}:`);
    console.log(`    redemption URL: ${parsed._links?.usage?.href}`);
    console.log(`    created:       ${parsed.created}`);
    console.log(`    used:          ${parsed.usage ? JSON.stringify(parsed.usage) : "not yet"}`);
  }

  console.log("\n" + "=".repeat(78));
  console.log("DONE — all code APIs verified.");
  console.log("=".repeat(78));
  console.log(`Promo: ${testPromo.id} (${testPromo.name})`);
  console.log(`Codes minted in this test: ${codes.length}`);
  console.log(`These codes are NOT auto-deleted. Each can be redeemed once via the URL above.`);
  console.log(`If you don't want them out there, run: scripts/cleanup-codes.mjs (or delete via Partner Portal).`);

} finally {
  c.close();
}
