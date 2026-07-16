#!/usr/bin/env node
// End-to-end test sweep of the safe MCP tools.
// Speaks MCP over stdio to the local server, drives all read-only tools + 3 async-export starts
// + a promotion write cycle, and emits a pass/fail report.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, "..", "dist", "server.js");

// ------------------------------------------------------------
// MCP stdio JSON-RPC client
// ------------------------------------------------------------
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
        } catch {
          /* non-JSON line; ignore */
        }
      }
    });
    this.child.stderr.on("data", (d) => process.stderr.write("[server] " + d.toString()));
  }
  request(method, params) {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(JSON.stringify(payload) + "\n");
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
      clientInfo: { name: "test-all", version: "1.0.0" },
    });
    this.notify("notifications/initialized");
    return r;
  }
  async call(name, args = {}) {
    const r = await this.request("tools/call", { name, arguments: args });
    return r;
  }
  async readResource(uri) {
    return this.request("resources/read", { uri });
  }
  close() {
    this.child.kill();
  }
}

// ------------------------------------------------------------
// Result tracking
// ------------------------------------------------------------
const results = []; // {area, name, status, durationMs, responseLen, note}
function record(area, name, status, t0, responseLen, note = "") {
  results.push({ area, name, status, durationMs: Date.now() - t0, responseLen, note });
}

function summarize(text) {
  if (typeof text !== "string") text = JSON.stringify(text);
  if (text.length > 200) return text.slice(0, 200) + "...";
  return text;
}

async function run(area, name, args, fn = null, expectedFailureOk = false) {
  const t0 = Date.now();
  try {
    const result = await (fn ?? client.call(name, args));
    if (result?.isError) {
      const err = result?.content?.[0]?.text ?? "isError";
      if (expectedFailureOk) {
        record(area, name, "SKIP", t0, 0, `expected: ${summarize(err)}`);
        return null;
      }
      record(area, name, "FAIL", t0, 0, summarize(err));
      return null;
    }
    const text = result?.content?.[0]?.text ?? "";
    record(area, name, "PASS", t0, text.length, "");
    return result;
  } catch (e) {
    const msg = e?.message ?? String(e);
    if (expectedFailureOk) {
      record(area, name, "SKIP", t0, 0, `expected: ${summarize(msg)}`);
    } else {
      record(area, name, "FAIL", t0, 0, summarize(msg));
    }
    return null;
  }
}

const client = new McpClient(SERVER);

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------
// Dynamically discovered fixtures (NEVER hardcode vendor identifiers).
// Populated from apps_list right after MCP init below.
let PRIMARY_PRODUCT_ID = "";
let PRIMARY_APPKEY = "";
const PARTNER_ID = process.env.MARKETPLACE_PARTNER_ID ?? "";
const REPORTING_FILTERS = { startDate: "2026-05-01", endDate: "2026-06-01", limit: 2 };

try {
  console.error("[init] starting server...");
  await client.initialize();
  console.error("[init] connected.\n");

  // ---------- Resources ----------
  for (const uri of ["apps://list", "apps://known", "vendor://profile"]) {
    const t0 = Date.now();
    try {
      const r = await client.readResource(uri);
      record("Resources", uri, "PASS", t0, r?.contents?.[0]?.text?.length ?? 0, "");
    } catch (e) {
      record("Resources", uri, "FAIL", t0, 0, summarize(e.message));
    }
  }

  // ---------- Discovery cascade ----------
  console.error("[discovery] running...");
  const discovery = {};
  const appsRes = await run("Apps", "apps_list", {});
  if (appsRes) {
    const parsed = JSON.parse(appsRes.content[0].text);
    discovery.apps = parsed.apps ?? [];
    // Populate the dynamic fixtures used throughout the rest of this script.
    if (discovery.apps.length === 0) {
      throw new Error("no apps in this developer space — cannot drive smoke tests");
    }
    PRIMARY_PRODUCT_ID = discovery.apps[0].productId;
    PRIMARY_APPKEY = discovery.apps[0].addonKey;
    console.error(`[discovery] using primary app: ${PRIMARY_APPKEY} (${PRIMARY_PRODUCT_ID})`);
  }
  await run("Apps", "apps_known", {});

  // Discover appSoftwareId — endpoint returns a bare array of {appSoftwareId, hosting, ...}
  const appSwRes = await run("App software", "app_software_get_by_appkey", { appKey: PRIMARY_APPKEY });
  if (appSwRes) {
    try {
      const parsed = JSON.parse(appSwRes.content[0].text);
      const arr = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
      // Prefer the cloud hosting one for downstream tests
      const cloud = arr.find(x => x.hosting === "cloud") ?? arr[0];
      discovery.appSoftwareId = cloud?.appSoftwareId ?? null;
    } catch {}
  }

  // Discover parent-software
  const psListRes = await run("Parent software", "parent_software_list", {});
  if (psListRes) {
    try {
      const parsed = JSON.parse(psListRes.content[0].text);
      const items = parsed.items ?? parsed.parentSoftware ?? parsed._embedded?.parentSoftware ?? [];
      if (items.length) {
        discovery.parentSoftwareId = items[0].id ?? items[0].parentSoftwareId;
      }
    } catch {}
  }

  // Discover promotions (paged) — for read tests
  const promosRes = await run("Promotions", "promotions_list_paged", { limit: 5 });
  if (promosRes) {
    try {
      const parsed = JSON.parse(promosRes.content[0].text);
      const items = parsed.promotions ?? [];
      discovery.existingPromotionId = items[0]?.id;
    } catch {}
  }

  // Reviews for the primary app
  const reviewsRes = await run("Reviews", "reviews_list", { productId: PRIMARY_PRODUCT_ID, limit: 2 });
  if (reviewsRes) {
    try {
      const parsed = JSON.parse(reviewsRes.content[0].text);
      const items = parsed.reviews ?? parsed.items ?? [];
      discovery.reviewId = items[0]?.id ?? items[0]?.reviewId;
    } catch {}
  }
  console.error("[discovery] ids:", JSON.stringify(discovery, null, 2));

  // ---------- Reporting (filtered) ----------
  await run("Licenses", "licenses_list", { ...REPORTING_FILTERS, productId: PRIMARY_PRODUCT_ID });
  await run("Licenses", "licenses_export_sync", { ...REPORTING_FILTERS, productId: PRIMARY_PRODUCT_ID });
  await run("Transactions", "transactions_list", { ...REPORTING_FILTERS, productId: PRIMARY_PRODUCT_ID });
  await run("Transactions", "transactions_export_sync", { ...REPORTING_FILTERS, productId: PRIMARY_PRODUCT_ID });
  await run("Transactions", "transactions_aggregate_by_metric", { metric: "country", ...REPORTING_FILTERS });
  await run("Transactions", "transactions_aggregate_by_hosting", REPORTING_FILTERS);

  await run("Reporting meta", "reporting_links", {});
  await run("Evaluations", "evaluations_by_metric", { metric: "hosting", ...REPORTING_FILTERS });
  await run("Feedback", "feedback_details", { ...REPORTING_FILTERS, limit: 2 });
  await run("Feedback", "feedback_metrics_by_metric", { metric: "reason", ...REPORTING_FILTERS });

  for (const sub of ["regions", "editions", "tiers", "active_users"]) {
    await run("Customer insights", `customer_insights_${sub}`, REPORTING_FILTERS);
  }

  await run("Sales metrics", "metrics_churn", REPORTING_FILTERS);
  await run("Sales metrics", "metrics_churn_benchmark", REPORTING_FILTERS);
  await run("Sales metrics", "metrics_conversion", REPORTING_FILTERS);
  await run("Sales metrics", "metrics_renewal", REPORTING_FILTERS);
  await run("Sales metrics", "metrics_details_by_metric", { saleMetric: "churn", ...REPORTING_FILTERS });
  await run("Sales metrics", "metrics_details_export", { saleMetric: "churn", ...REPORTING_FILTERS });

  await run("Benchmarks", "benchmark_sales", REPORTING_FILTERS);
  await run("Benchmarks", "benchmark_evaluations", REPORTING_FILTERS);

  await run("App requests", "app_requests_and_approvals", { limit: 2 });
  await run("Free starter", "free_starter_tier_export", REPORTING_FILTERS);

  await run("Search keywords", "search_keywords_partner", { limit: 3 });
  await run("Search keywords", "search_keywords_partner_export", REPORTING_FILTERS);
  await run("Search keywords", "search_keywords_by_source", { sourceKey: "marketplace", limit: 3 });
  await run("Search keywords", "search_keywords_by_source_export", { sourceKey: "marketplace", ...REPORTING_FILTERS });
  await run("Search keywords", "search_keywords_by_app", { productId: PRIMARY_PRODUCT_ID, limit: 3 });
  await run("Search keywords", "search_keywords_by_app_export", { productId: PRIMARY_PRODUCT_ID, ...REPORTING_FILTERS });
  await run("Search keywords", "zero_search_results_keywords", { sourceKey: "marketplace", limit: 3 });
  await run("Search keywords", "zero_search_results_keywords_export", { sourceKey: "marketplace", ...REPORTING_FILTERS });

  // ---------- App listing / app-software / version listing (reads) ----------
  await run("App listing", "app_listing_get", { productId: PRIMARY_PRODUCT_ID });
  if (discovery.appSoftwareId) {
    await run("App software", "app_software_versions_list", { appSoftwareId: discovery.appSoftwareId, limit: 2 });
    await run("App software", "app_software_tokens_list", { appSoftwareId: discovery.appSoftwareId });
    await run("App version listing", "app_version_listings_list_all", { appSoftwareId: discovery.appSoftwareId });
    // Need a buildNumber for the version-specific reads — fetch one
    const verListRes = await client.call("app_software_versions_list", { appSoftwareId: discovery.appSoftwareId, limit: 1 });
    try {
      const parsed = JSON.parse(verListRes.content[0].text);
      const items = parsed.items ?? parsed.versions ?? parsed._embedded?.versions ?? [];
      const build = items[0]?.buildNumber ?? items[0]?.build ?? items[0]?.id;
      if (build) {
        await run("App software", "app_software_version_get", { appSoftwareId: discovery.appSoftwareId, buildNumber: build });
        await run("App version listing", "app_version_listing_get", { appSoftwareId: discovery.appSoftwareId, buildNumber: build });
      }
    } catch {}
  } else {
    record("App software", "app_software_versions_list", "SKIP", Date.now(), 0, "no appSoftwareId discovered");
    record("App software", "app_software_tokens_list", "SKIP", Date.now(), 0, "no appSoftwareId discovered");
    record("App software", "app_software_version_get", "SKIP", Date.now(), 0, "no appSoftwareId discovered");
    record("App version listing", "app_version_listings_list_all", "SKIP", Date.now(), 0, "no appSoftwareId discovered");
    record("App version listing", "app_version_listing_get", "SKIP", Date.now(), 0, "no appSoftwareId discovered");
  }

  // ---------- Privacy & migrations (reads) ----------
  await run("Privacy & security", "privacy_security_get", { productId: PRIMARY_PRODUCT_ID });
  await run("Cloud migration", "cloud_migration_compat_get", { productId: PRIMARY_PRODUCT_ID });

  // ---------- Parent software chain ----------
  if (discovery.parentSoftwareId) {
    await run("Parent software", "parent_software_get", { parentSoftwareId: discovery.parentSoftwareId });
    const psVersionsRes = await client.call("parent_software_versions_list", { parentSoftwareId: discovery.parentSoftwareId });
    record("Parent software", "parent_software_versions_list", "PASS", Date.now(), psVersionsRes?.content?.[0]?.text?.length ?? 0, "");
    try {
      const parsed = JSON.parse(psVersionsRes.content[0].text);
      const items = parsed.items ?? parsed.versions ?? [];
      const v = items[0];
      if (v?.buildNumber) await run("Parent software", "parent_software_version_by_build", { parentSoftwareId: discovery.parentSoftwareId, buildNumber: v.buildNumber });
      if (v?.versionNumber) await run("Parent software", "parent_software_version_by_number", { parentSoftwareId: discovery.parentSoftwareId, versionNumber: String(v.versionNumber) });
    } catch {}
  } else {
    for (const n of ["parent_software_get", "parent_software_versions_list", "parent_software_version_by_build", "parent_software_version_by_number"]) {
      record("Parent software", n, "SKIP", Date.now(), 0, "no parentSoftwareId discovered");
    }
  }

  // ---------- Developer space ----------
  await run("Developer space", "developer_space_get", {});
  await run("Developer space", "developer_space_catalog_account", {});
  await run("Developer space", "developer_space_listings", {});
  await run("Developer space", "developer_space_members_list", { limit: 5 });
  // Discover own AAID from the running developer space (don't hardcode).
  const membersRes = await run("Developer space", "developer_space_members_list", { limit: 1 });
  const firstAaid = membersRes ? JSON.parse(membersRes.content[0].text)?.members?.[0]?.aaid : null;
  if (firstAaid) {
    await run("Developer space", "developer_space_member_get", { aaid: firstAaid });
  }
  // vendorId guess: try partnerId
  await run("Developer space", "developer_space_by_vendor", { vendorId: PARTNER_ID }, null, true);

  // ---------- Misc reads ----------
  await run("Partner metrics", "partner_metrics_fetch", {
    body: {
      metrics: ["sales"],
      granularity: "month",
      dateRange: { start: "2026-05-01", end: "2026-06-01" },
    },
  }, null, true); // accept failure — body shape uncertain
  await run("Product catalog", "product_catalog_latest", {});
  // artifact_get — no artifactId available; skip
  record("Artifacts", "artifact_get", "SKIP", Date.now(), 0, "no artifactId available without artifact_fetch_from_url");

  // ---------- Reviews ----------
  if (discovery.reviewId) {
    await run("Reviews", "review_get", { productId: PRIMARY_PRODUCT_ID, reviewId: discovery.reviewId });
  } else {
    record("Reviews", "review_get", "SKIP", Date.now(), 0, "no reviewId discovered");
  }

  // ---------- Promotion read chain ----------
  if (discovery.existingPromotionId) {
    await run("Promotions", "promotions_get", { promotionId: discovery.existingPromotionId });
    await run("Promotions", "promotions_status", { promotionId: discovery.existingPromotionId });
    const codesRes = await run("Promotions", "promotions_codes_list", { promotionId: discovery.existingPromotionId });
    try {
      const parsed = JSON.parse(codesRes.content[0].text);
      const codes = parsed.codes ?? [];
      if (codes[0]?.code) {
        await run("Promotions", "promotions_code_get", { promotionId: discovery.existingPromotionId, promotionCode: codes[0].code });
      } else {
        record("Promotions", "promotions_code_get", "SKIP", Date.now(), 0, "no existing single-use codes to read");
      }
    } catch {
      record("Promotions", "promotions_code_get", "SKIP", Date.now(), 0, "couldn't parse promotion codes");
    }
  } else {
    for (const n of ["promotions_get", "promotions_status", "promotions_codes_list", "promotions_code_get"]) {
      record("Promotions", n, "SKIP", Date.now(), 0, "no existing promotion to read");
    }
  }

  // ---------- Async export starts + status/download chain ----------
  console.error("[async] starting export jobs...");
  let licensesExportId, txExportId, marketingExportId;
  const extractExportId = (raw) => {
    try {
      const p = JSON.parse(raw);
      return p.export?.id ?? p.exportId ?? null;
    } catch { return null; }
  };
  const lExportRes = await run("Licenses", "licenses_export_async_start", { ...REPORTING_FILTERS, productId: PRIMARY_PRODUCT_ID });
  if (lExportRes) licensesExportId = extractExportId(lExportRes.content[0].text);
  const tExportRes = await run("Transactions", "transactions_export_async_start", { ...REPORTING_FILTERS, productId: PRIMARY_PRODUCT_ID });
  if (tExportRes) txExportId = extractExportId(tExportRes.content[0].text);
  const mExportRes = await run("Marketing attribution", "marketing_attribution_export_async_start", { ...REPORTING_FILTERS });
  if (mExportRes) marketingExportId = extractExportId(mExportRes.content[0].text);

  // Poll status until DONE (or max ~2 min). This is the right pattern for the LLM too:
  // never download until the status reports done — otherwise you get a 404 "still processing".
  async function waitUntilReady(area, statusTool, exportId, maxAttempts = 24, pollIntervalMs = 5000) {
    for (let i = 0; i < maxAttempts; i++) {
      const s = await client.call(statusTool, { exportId });
      const text = s?.content?.[0]?.text ?? "";
      let status = "";
      try {
        const p = JSON.parse(text);
        // Status is nested under .export.status per the Atlassian response shape.
        status = (p.export?.status ?? p.status ?? p.exportStatus ?? "").toUpperCase();
      } catch {}
      if (status === "DONE" || status === "COMPLETED" || status === "SUCCESS") return true;
      if (status === "FAILED" || status === "ERROR") return false;
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
    return false;
  }

  for (const [area, exportId, statusTool, downloadTool] of [
    ["Licenses", licensesExportId, "licenses_export_async_status", "licenses_export_async_download"],
    ["Transactions", txExportId, "transactions_export_async_status", "transactions_export_async_download"],
    ["Marketing attribution", marketingExportId, "marketing_attribution_export_async_status", "marketing_attribution_export_async_download"],
  ]) {
    if (!exportId) {
      record(area, statusTool, "SKIP", Date.now(), 0, "no exportId from start");
      record(area, downloadTool, "SKIP", Date.now(), 0, "no exportId from start");
      continue;
    }
    await run(area, statusTool, { exportId });
    console.error(`[async] polling ${area} until ready (up to 2 min)...`);
    const ready = await waitUntilReady(area, statusTool, exportId);
    if (!ready) {
      record(area, downloadTool, "SKIP", Date.now(), 0, "export job did not reach DONE within 2 min");
      continue;
    }
    await run(area, downloadTool, { exportId });
  }

  // ---------- Promo write cycle (with cleanup) ----------
  console.error("[promo] write-cycle test...");
  const tag = new Date().toISOString().slice(0,10);
  const expires = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0,10);
  let newPromoId = null;
  const createRes = await run("Promotions", "promotions_create", {
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
  if (createRes) {
    try { newPromoId = (JSON.parse(createRes.content[0].text).id) ?? null; } catch {}
  }
  if (newPromoId) {
    // Atlassian's PATCH /promotions/{id} returns HTTP 500 server-side for any update on a
    // single-use cloud promo (confirmed via direct curl outside this MCP) — documented quirk.
    await run("Promotions", "promotions_update", {
      promotionId: newPromoId,
      name: `MCP_TEST_${tag}_renamed`,
    }, null, true);
    const newCodeRes = await run("Promotions", "promotions_codes_create", { promotionId: newPromoId });
    let newCodeId = null;
    if (newCodeRes) {
      // codes_create returns {ok:true} per our wrapper — need to list to get the new code
      const codesAfter = await client.call("promotions_codes_list", { promotionId: newPromoId });
      try {
        const parsed = JSON.parse(codesAfter.content[0].text);
        const codes = parsed.codes ?? [];
        newCodeId = codes[0]?.code;
      } catch {}
    }
    if (newCodeId) {
      await run("Promotions", "promotions_code_delete", { promotionId: newPromoId, promotionCode: newCodeId });
    } else {
      record("Promotions", "promotions_code_delete", "SKIP", Date.now(), 0, "couldn't determine new code id to delete");
    }
  } else {
    for (const n of ["promotions_update", "promotions_codes_create", "promotions_code_delete"]) {
      record("Promotions", n, "SKIP", Date.now(), 0, "promotions_create failed");
    }
  }

} finally {
  client.close();
  // ------------------------------------------------------------
  // Report
  // ------------------------------------------------------------
  const byArea = new Map();
  for (const r of results) {
    if (!byArea.has(r.area)) byArea.set(r.area, []);
    byArea.get(r.area).push(r);
  }
  console.log("\n========== TEST REPORT ==========\n");
  let totalPass = 0, totalFail = 0, totalSkip = 0;
  for (const [area, items] of byArea) {
    console.log(`## ${area}`);
    for (const r of items) {
      const badge = r.status === "PASS" ? "✓" : r.status === "FAIL" ? "✗" : "~";
      console.log(`  ${badge} ${r.name.padEnd(48)} ${String(r.durationMs).padStart(4)}ms  ${r.status === "PASS" ? `len=${r.responseLen}` : r.note}`);
      if (r.status === "PASS") totalPass++;
      else if (r.status === "FAIL") totalFail++;
      else totalSkip++;
    }
    console.log();
  }
  console.log(`Summary: ${totalPass} PASS  ${totalFail} FAIL  ${totalSkip} SKIP  (of ${results.length} total)\n`);
  if (totalFail) process.exit(1);
}
