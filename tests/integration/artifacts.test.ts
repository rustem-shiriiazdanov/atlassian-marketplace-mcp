/**
 * Integration tests for the artifact tools.
 *
 * `artifact_fetch_from_url` (POST) stores an artifact on SUCCESS, so tests
 * deliberately drive it with a well-formed-but-unfetchable URL: this exercises
 * the real live endpoint and proves the request body is shaped correctly
 * (field `uri`, not `url`) WITHOUT ever creating an orphan artifact — the call
 * gets past server-side validation and fails only at the remote-fetch stage.
 *
 * Regression guard: the tool used to send `{ url }`, which the API rejected with
 * 400 "Invalid value for field 'uri'". The body must send `{ uri }`.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpTestClient, hasLiveCreds } from "../helpers/mcp-test-client.js";

describe.skipIf(!hasLiveCreds())("Block F: Artifacts (live API)", () => {
  let client: McpTestClient;
  beforeAll(async () => { client = await McpTestClient.start(); });
  afterAll(async () => { await client.close(); });

  describe("artifact_fetch_from_url", () => {
    it("sends the required `uri` field — passes validation and fails only at the fetch stage (no artifact stored)", async () => {
      const err = await client.callToolExpectingError("artifact_fetch_from_url", {
        url: "https://example.com/nonexistent-artifact-xyz.jar",
      });
      // The old bug sent `{ url }` → this exact message. It must NOT appear now.
      expect(err).not.toMatch(/Invalid value for field 'uri'/i);
      // Instead the request is accepted and fails downstream trying to fetch the URL.
      expect(err).toMatch(/ARTIFACT_REMOTE_FETCH_FAILURE|fetch artifact from|remote/i);
    }, 30_000);

    it("requires a valid url (Zod rejects non-URLs)", async () => {
      const err = await client.callToolExpectingError("artifact_fetch_from_url", { url: "not-a-url" });
      expect(err.toLowerCase()).toMatch(/url|invalid/);
    });

    it("is annotated WRITE_SAFE (writeable, not read-only) with {url, extra}", async () => {
      const tools = await client.listTools();
      const t = tools.find((x) => x.name === "artifact_fetch_from_url")!;
      expect((t.annotations as { readOnlyHint?: boolean }).readOnlyHint).toBe(false);
      const props = Object.keys((t.inputSchema as { properties: Record<string, unknown> }).properties).sort();
      expect(props).toEqual(["extra", "url"]);
    });
  });

  describe("artifact_get", () => {
    it("unknown artifactId surfaces a 404 error", async () => {
      const err = await client.callToolExpectingError("artifact_get", { artifactId: "nonexistent-artifact-id" });
      expect(err).toMatch(/404|not found/i);
    });

    it("requires artifactId (Zod)", async () => {
      const err = await client.callToolExpectingError("artifact_get", {});
      expect(err.toLowerCase()).toMatch(/artifactid|required|invalid/);
    });
  });
});
