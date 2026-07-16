/**
 * Unit tests for the shared helpers in src/tools/_shared.ts.
 *
 * No live API, no MCP — pure logic. Runs in <1s. Safe for new users without
 * Atlassian creds (the `test:unit` npm script injects sentinel env values).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, unlinkSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { asQuery, jsonResult } from "../../src/tools/_shared.js";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");

/**
 * `MAX_RESPONSE_CHARS` is read once at module-load time, so we can't change it
 * within this process. Spawn a fresh `node` that imports the COMPILED helper
 * with the env set, calls jsonResult on a large payload, and prints whether it
 * truncated. Pure logic, no network, no mocks — just process isolation to
 * control a load-time env var.
 */
function runJsonResultWith(envValue: string, payloadSize: number): { truncated: boolean } {
  const script = `
    import { jsonResult } from ${JSON.stringify(join(REPO_ROOT, "dist/tools/_shared.js"))};
    const out = jsonResult({ rows: new Array(${payloadSize}).fill("padding-text-block-to-inflate-size") });
    let parsed; try { parsed = JSON.parse(out.content[0].text); } catch { parsed = {}; }
    process.stdout.write(JSON.stringify({ truncated: parsed._truncated === true }));
  `;
  const stdout = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    env: { ...process.env, MAX_RESPONSE_CHARS: envValue },
    encoding: "utf-8",
  });
  return JSON.parse(stdout);
}

describe("asQuery", () => {
  it("passes through scalar values verbatim", () => {
    const out = asQuery({ a: "hello", b: 42, c: true, d: false });
    expect(out).toEqual({ a: "hello", b: 42, c: true, d: false });
  });

  it("drops undefined entries (the canonical 'skip optional filter' pattern)", () => {
    const out = asQuery({ a: "x", b: undefined, c: 1 });
    expect(out).toEqual({ a: "x", c: 1 });
    expect("b" in out).toBe(false);
  });

  it("KEEPS null entries (callers shouldn't pass null but if they do, it goes through as a string by request())", () => {
    const out = asQuery({ a: "x", b: null as unknown as undefined });
    expect("b" in out).toBe(true);
  });

  it("keeps empty string (different from undefined — empty is a valid filter value)", () => {
    const out = asQuery({ q: "" });
    expect(out).toEqual({ q: "" });
  });

  it("keeps zero (different from undefined — 0 is a valid value)", () => {
    const out = asQuery({ tier: 0, limit: 0 });
    expect(out).toEqual({ tier: 0, limit: 0 });
  });
});

describe("jsonResult — inline (small) payloads", () => {
  it("returns a single text-content envelope for small JSON", () => {
    const out = jsonResult({ a: 1, b: "x" });
    expect(out).toEqual({
      content: [{ type: "text", text: JSON.stringify({ a: 1, b: "x" }, null, 2) }],
    });
  });

  it("passes string payloads through verbatim (no JSON re-serialization)", () => {
    const out = jsonResult("hello,world,csv");
    expect(out.content[0].type).toBe("text");
    expect(out.content[0].text).toBe("hello,world,csv");
  });

  it("preserves nested structure under JSON.stringify (indent=2)", () => {
    const out = jsonResult({ outer: { inner: [1, 2, 3] } });
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed).toEqual({ outer: { inner: [1, 2, 3] } });
  });
});

describe("jsonResult — truncation envelope (large payloads)", () => {
  // Reset any tmp files we create so tests are idempotent
  const tmpFiles: string[] = [];
  afterEach(() => {
    for (const f of tmpFiles) try { unlinkSync(f); } catch {}
    tmpFiles.length = 0;
  });

  it("spills payloads over MAX_RESPONSE_CHARS (default 50_000) to a tmp file", () => {
    const big = { rows: new Array(20_000).fill({ a: "filler-value-padding-text" }) };
    const out = jsonResult(big);
    const env = JSON.parse(out.content[0].text);
    expect(env._truncated).toBe(true);
    expect(typeof env._file).toBe("string");
    expect(env._file).toMatch(/atlassian-mcp-[a-f0-9]{16}\.json$/);
    expect(env._bytes).toBeGreaterThan(50_000);
    expect(env._hint).toContain("MAX_RESPONSE_CHARS");
    expect(env._preview).toBeTruthy();
    expect(env._preview.length).toBeLessThanOrEqual(2000);
    expect(existsSync(env._file)).toBe(true);
    tmpFiles.push(env._file);
    // Tmp file content round-trips to the original payload.
    const onDisk = readFileSync(env._file, "utf-8");
    expect(JSON.parse(onDisk)).toEqual(big);
    // For ASCII content, byte size == char count == on-disk size.
    expect(env._bytes).toBe(onDisk.length);
    expect(env._chars).toBe(onDisk.length);
  });

  it("_bytes reports true UTF-8 byte size (not JS char count) for multibyte content", () => {
    // 🎉 is 2 JS UTF-16 code units but 4 UTF-8 bytes. _bytes must match disk.
    const big = { note: "🎉".repeat(30_000) };
    const out = jsonResult(big);
    const env = JSON.parse(out.content[0].text);
    expect(env._truncated).toBe(true);
    tmpFiles.push(env._file);
    const diskBytes = statSync(env._file).size;
    expect(env._bytes).toBe(diskBytes);          // honest byte count
    expect(env._bytes).toBeGreaterThan(env._chars); // bytes > chars for multibyte
  });

  it("is content-addressed: same input → same tmp file path (idempotent)", () => {
    const big1 = { items: new Array(10_000).fill("filler-text-for-padding-the-payload") };
    const big2 = { items: new Array(10_000).fill("filler-text-for-padding-the-payload") };
    const out1 = JSON.parse(jsonResult(big1).content[0].text);
    const out2 = JSON.parse(jsonResult(big2).content[0].text);
    expect(out1._file).toBe(out2._file);
    tmpFiles.push(out1._file);
  });

  it("different inputs → different tmp files (hash-based collision avoidance)", () => {
    const a = { items: new Array(10_000).fill("DISTINCT-FILLER-A") };
    const b = { items: new Array(10_000).fill("DISTINCT-FILLER-B") };
    const outA = JSON.parse(jsonResult(a).content[0].text);
    const outB = JSON.parse(jsonResult(b).content[0].text);
    expect(outA._file).not.toBe(outB._file);
    tmpFiles.push(outA._file, outB._file);
  });

  it("non-JSON-looking string payloads get .txt extension", () => {
    const csv = "header1,header2\n" + "v1,v2\n".repeat(20_000);
    const env = JSON.parse(jsonResult(csv).content[0].text);
    expect(env._truncated).toBe(true);
    expect(env._file).toMatch(/\.txt$/);
    tmpFiles.push(env._file);
  });

  it("JSON-array payloads get .json extension (auto-detected from preview)", () => {
    const arr = new Array(20_000).fill({ x: "padding" });
    const env = JSON.parse(jsonResult(arr).content[0].text);
    expect(env._truncated).toBe(true);
    expect(env._file).toMatch(/\.json$/);
    tmpFiles.push(env._file);
  });

  it("writes the spill file under os.tmpdir()", () => {
    const big = { rows: new Array(20_000).fill("padding-text-block") };
    const env = JSON.parse(jsonResult(big).content[0].text);
    expect(env._file.startsWith(join(tmpdir(), "atlassian-mcp-"))).toBe(true);
    tmpFiles.push(env._file);
  });
});

describe("jsonResult — MAX_RESPONSE_CHARS=0 disables truncation (process-isolated)", () => {
  it("with the default threshold, a large payload IS truncated", () => {
    const r = runJsonResultWith("50000", 20_000);
    expect(r.truncated).toBe(true);
  });

  it("with MAX_RESPONSE_CHARS=0, the same large payload is returned INLINE (truncation disabled)", () => {
    // Regression guard for the bug where `=0` meant `length <= 0` → truncate everything.
    const r = runJsonResultWith("0", 20_000);
    expect(r.truncated).toBe(false);
  });

  it("a negative MAX_RESPONSE_CHARS also disables truncation", () => {
    const r = runJsonResultWith("-1", 20_000);
    expect(r.truncated).toBe(false);
  });
});

describe("jsonResult — boundary (exactly at 50_000 chars)", () => {
  it("payload exactly at the threshold is inline (not truncated)", () => {
    // Build a string that serializes to exactly MAX_RESPONSE_CHARS chars.
    // JSON.stringify("x".repeat(49_998), null, 2) = '"' + 49_998 + '"' = 50_000 chars.
    const exactlyAtThreshold = "x".repeat(49_998);
    const out = jsonResult(exactlyAtThreshold);
    expect(out.content[0].text).toBe(exactlyAtThreshold);
    expect(out.content[0].text.length).toBe(49_998);
    // No _truncated field
    expect(() => {
      const parsed = JSON.parse(out.content[0].text);
      expect((parsed as any)?._truncated).toBeUndefined();
    }).toThrow(); // it's not JSON, just a string
  });
});
