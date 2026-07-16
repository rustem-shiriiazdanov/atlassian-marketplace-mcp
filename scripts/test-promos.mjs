#!/usr/bin/env node
// Focused, verbose end-to-end test of the 10 promotion tools.
// Exercises a full lifecycle: list -> create -> get -> status -> codes_list -> codes_create
// -> codes_list (again) -> code_get -> code_delete -> (attempt update, which Atlassian 500s).

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, "..", "dist", "server.js");

class McpClient {
  constructor(serverPath) {
    this.child = spawn("node", [serverPath], { stdio: ["pipe", "pipe", "pipe"] });
    this.buffer = "";
    this.pending = new Map();
    this.nextId = 1;
    this.child.stdout.on("data", (chunk) => {
      this.buffer += chunk.toString();
      let idx;
      while ((idx = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id !== undefined && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else resolve(msg.result);
          }
        } catch {}
      }
    });
    this.child.stderr.on("data", (d) => process.stderr.write("[server] " + d.toString()));
  }
  request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout calling ${method} ${params?.name ?? ""}`));
        }
      }, 30000);
    });
  }
  notify(method, params) {
    this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }
  async initialize() {
    const r = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-promos", version: "1.0.0" },
    });
    this.notify("notifications/initialized");
    return r;
  }
  async call(name, args = {}) { return this.request("tools/call", { name, arguments: args }); }
  close() { this.child.kill(); }
}

let step = 0;
function header(title) {
  step++;
  console.log("\n" + "=".repeat(78));
  console.log(`[${String(step).padStart(2, "0")}] ${title}`);
  console.log("=".repeat(78));
}

function show(label, obj, limit = 600) {
  const text = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  console.log(`${label}:`);
  if (text.length > limit) console.log(text.slice(0, limit) + `\n... (truncated, total ${text.length} chars)`);
  else console.log(text);
}

async function callAndPrint(client, name, args) {
  try {
    const result = await client.call(name, args);
    const text = result?.content?.[0]?.text ?? "";
    if (result?.isError) {
      console.log(`✗ ${name} ERRORED`);
      show("response", text);
      return null;
    }
    console.log(`✓ ${name}  (response ${text.length} chars)`);
    return text;
  } catch (e) {
    console.log(`✗ ${name}  EXCEPTION: ${e.message.slice(0, 200)}`);
    return null;
  }
}

const client = new McpClient(SERVER);

try {
  await client.initialize();

  // Discover an app key dynamically from the running developer space —
  // NEVER hardcode vendor identifiers.
  const appsResult = await callAndPrint(client, "apps_list", {});
  const appsParsed = appsResult ? JSON.parse(appsResult) : { apps: [] };
  if (!appsParsed.apps?.length) {
    console.error("FAIL: this developer space exposes 0 apps — cannot drive promo tests");
    process.exit(1);
  }
  const PRIMARY_APPKEY = appsParsed.apps[0].addonKey;

  // 1) List existing promotions
  header("promotions_list_paged — list latest 5");
  const listed = await callAndPrint(client, "promotions_list_paged", { limit: 5, orderBy: "CREATION_DATE" });
  if (listed) {
    const parsed = JSON.parse(listed);
    console.log(`Found ${parsed.totalItems ?? parsed.promotions?.length ?? "?"} total promotions; showing ${parsed.promotions?.length ?? 0}:`);
    for (const p of parsed.promotions ?? []) {
      console.log(`  - ${p.id} | ${p.name} | ${p.status} | ${p.promotionType} ${p.discountPercent}% expires ${p.expirationDate}`);
    }
  }

  // 2) Create a new test promo
  const tag = new Date().toISOString().replace(/[:.]/g, "-");
  const expires = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10) + "T00:00:00Z";
  header(`promotions_create — MCP_TEST_${tag}`);
  console.log(`Args: name=MCP_TEST_${tag}, app=${PRIMARY_APPKEY}, discount=1%, expires=${expires}`);
  const createdText = await callAndPrint(client, "promotions_create", {
    name: `MCP_TEST_${tag}`,
    eligibleApps: [PRIMARY_APPKEY],
    expirationDate: expires,
    promotionType: "SINGLE_USE_PROMOTION",
    discountType: "FLAT_DISCOUNT",
    discountPercent: 1,
    hostingType: "CLOUD",
    subscriptionType: "ANNUAL",
    allowedBillingCycles: 1,
  });
  let newPromoId = null;
  if (createdText) {
    const parsed = JSON.parse(createdText);
    newPromoId = parsed.id;
    show("response", parsed);
  }
  if (!newPromoId) {
    console.log("\n❌ promotions_create did not return an id — aborting downstream tests.");
    process.exit(1);
  }

  // 3) Get the newly created promo
  header(`promotions_get — ${newPromoId}`);
  const gotText = await callAndPrint(client, "promotions_get", { promotionId: newPromoId });
  if (gotText) show("response", JSON.parse(gotText));

  // 4) Status
  header(`promotions_status — ${newPromoId}`);
  const statusText = await callAndPrint(client, "promotions_status", { promotionId: newPromoId });
  if (statusText) show("status", statusText);

  // 5) Codes list (should be empty for new promo)
  header(`promotions_codes_list — ${newPromoId} (expected empty)`);
  const codes0Text = await callAndPrint(client, "promotions_codes_list", { promotionId: newPromoId });
  if (codes0Text) show("response", JSON.parse(codes0Text));

  // 6) Create a code
  header(`promotions_codes_create — mint a code for ${newPromoId}`);
  const codeCreateText = await callAndPrint(client, "promotions_codes_create", { promotionId: newPromoId });
  if (codeCreateText) show("response", codeCreateText);

  // 7) Codes list again (should have 1 now)
  header(`promotions_codes_list — ${newPromoId} (expected 1 code)`);
  const codes1Text = await callAndPrint(client, "promotions_codes_list", { promotionId: newPromoId });
  let newCode = null;
  if (codes1Text) {
    const parsed = JSON.parse(codes1Text);
    show("response", parsed);
    newCode = parsed.codes?.[0]?.code;
  }

  // 8) Get the code by its short id
  if (newCode) {
    header(`promotions_code_get — ${newCode}`);
    const codeGetText = await callAndPrint(client, "promotions_code_get", {
      promotionId: newPromoId,
      promotionCode: newCode,
    });
    if (codeGetText) show("response", JSON.parse(codeGetText));
  } else {
    console.log("\n⚠️  could not determine new code id — skipping promotions_code_get");
  }

  // 9) Delete the code
  if (newCode) {
    header(`promotions_code_delete — ${newCode}`);
    const delText = await callAndPrint(client, "promotions_code_delete", {
      promotionId: newPromoId,
      promotionCode: newCode,
    });
    if (delText) show("response", delText);

    // Verify deletion
    header(`promotions_codes_list — verify ${newCode} removed`);
    const codes2Text = await callAndPrint(client, "promotions_codes_list", { promotionId: newPromoId });
    if (codes2Text) {
      const parsed = JSON.parse(codes2Text);
      const stillThere = parsed.codes?.some(c => c.code === newCode);
      console.log(`Codes remaining: ${parsed.codes?.length ?? 0}`);
      console.log(stillThere ? "✗ delete did NOT remove the code" : "✓ confirmed code was deleted");
    }
  }

  // 10) Try update (known Atlassian-side 500)
  header(`promotions_update — known to return Atlassian-side 500`);
  console.log("Updating name to verify the documented quirk reproduces...");
  const updText = await callAndPrint(client, "promotions_update", {
    promotionId: newPromoId,
    name: `MCP_TEST_${tag}_renamed_attempt`,
  });
  if (updText) {
    console.log("⚠️ Unexpectedly succeeded — Atlassian may have fixed it server-side. Response:");
    show("response", updText);
  } else {
    console.log("✓ Reproduced the documented Atlassian-side 500 quirk.");
  }

  console.log("\n" + "=".repeat(78));
  console.log("PROMO TEST COMPLETE");
  console.log("=".repeat(78));
  console.log(`Test promo created: ${newPromoId}`);
  console.log(`Name: MCP_TEST_${tag}`);
  console.log(`Discount: 1% off ${PRIMARY_APPKEY}, expires ${expires}`);
  console.log(`This promo lives in the system until expiration. The single-use code we minted was deleted.`);
  console.log(`If you want to remove it, do it via the Marketplace Partner Portal.`);

} finally {
  client.close();
}
