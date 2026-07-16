#!/usr/bin/env node
/**
 * Post-process the TypeDoc HTML in `docs/api/` so every external link opens in
 * a new tab. TypeDoc 0.28 doesn't set `target` on `<a href="https?://...">`
 * out of the box, so links lose context (replace the docs page) and IDE preview
 * panes (VSCode/Cursor) block external navigation entirely.
 *
 * Idempotent: re-runs are no-ops on already-patched anchors.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../docs/api/", import.meta.url).pathname;

// External-link pattern: <a ... href="http(s)://..." ...> (no target= yet)
const EXTERNAL_LINK = /<a\b([^>]*?)\bhref="(https?:\/\/[^"]+)"([^>]*?)>/gi;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (name.endsWith(".html")) patchFile(p);
  }
}

let patchedAnchors = 0;
let patchedFiles = 0;

function patchFile(path) {
  const src = readFileSync(path, "utf-8");
  let count = 0;
  const out = src.replace(EXTERNAL_LINK, (match, pre, href, post) => {
    // Skip if target= is already there (idempotent).
    if (/\btarget=/i.test(pre + post)) return match;
    count++;
    return `<a${pre}href="${href}"${post} target="_blank" rel="noopener noreferrer">`;
  });
  if (count > 0) {
    writeFileSync(path, out);
    patchedAnchors += count;
    patchedFiles++;
  }
}

walk(ROOT);
console.log(`Patched ${patchedAnchors} external link(s) across ${patchedFiles} file(s) in docs/api/`);
