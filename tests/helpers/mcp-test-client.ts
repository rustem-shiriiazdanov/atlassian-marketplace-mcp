/**
 * Thin async MCP-over-stdio client used by the integration test suite.
 *
 * Spawns `node dist/server.js` as a child process, exchanges JSON-RPC over
 * stdio. Reuse a single client across many tests in one file via `beforeAll` +
 * `afterAll` — spawning is expensive (~200ms).
 *
 * The public env-gate `hasLiveCreds()` lets test files skip themselves cleanly
 * when run in a CI environment without secrets.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, "..", "..", "dist", "server.js");

export function hasLiveCreds(): boolean {
  return Boolean(
    process.env.ATLASSIAN_EMAIL &&
    process.env.ATLASSIAN_API_TOKEN &&
    process.env.MARKETPLACE_DEVELOPER_ID &&
    process.env.MARKETPLACE_PARTNER_ID
  );
}

type JsonRpcResolver = (msg: { result?: any; error?: { message: string } }) => void;

export class McpTestClient {
  private child!: ChildProcessWithoutNullStreams;
  private buf = "";
  private pending = new Map<number, JsonRpcResolver>();
  private nextId = 1;

  static async start(): Promise<McpTestClient> {
    const c = new McpTestClient();
    c.spawn();
    await c.initialize();
    return c;
  }

  private spawn(): void {
    this.child = spawn("node", [SERVER_PATH], { stdio: ["pipe", "pipe", "pipe"] });
    this.child.stdout.on("data", (chunk) => {
      this.buf += chunk.toString();
      let idx: number;
      while ((idx = this.buf.indexOf("\n")) >= 0) {
        const line = this.buf.slice(0, idx).trim();
        this.buf = this.buf.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id !== undefined && this.pending.has(msg.id)) {
            const resolve = this.pending.get(msg.id)!;
            this.pending.delete(msg.id);
            resolve(msg);
          }
        } catch {
          /* non-JSON line; ignore */
        }
      }
    });
    // Pipe server stderr to ours so test failures show server-side errors.
    this.child.stderr.on("data", (d) => process.stderr.write(d));
  }

  private rpc<T = unknown>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, (msg) => {
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result as T);
      });
      this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP rpc timeout: ${method}`));
        }
      }, 90_000);
    });
  }

  private notify(method: string, params?: unknown): void {
    this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  private async initialize(): Promise<void> {
    await this.rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
    this.notify("notifications/initialized");
  }

  /** Call a tool. Returns the parsed text result (JSON) or throws on isError / RPC error. */
  async callTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await this.rpc<{ content: Array<{ text: string }>; isError?: boolean }>(
      "tools/call",
      { name, arguments: args }
    );
    const text = result.content?.[0]?.text ?? "";
    if (result.isError) throw new Error(`tool ${name} returned isError: ${text}`);
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  /**
   * Call a tool expecting it to fail (Zod validation OR isError from the handler).
   * Returns the error text. The MCP SDK returns Zod validation errors as
   * `result.isError = true` (NOT as a JSON-RPC error), so we have to inspect the result.
   */
  async callToolExpectingError(name: string, args: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.rpc<{ content: Array<{ text: string }>; isError?: boolean }>(
        "tools/call",
        { name, arguments: args }
      );
      if (result.isError) {
        return result.content?.[0]?.text ?? "(isError but no text)";
      }
      throw new Error(`expected tool ${name} to fail, but it succeeded`);
    } catch (e) {
      return (e as Error).message;
    }
  }

  async listTools(): Promise<Array<{ name: string; description?: string; inputSchema: unknown; annotations?: unknown }>> {
    const r = await this.rpc<{ tools: any[] }>("tools/list", {});
    return r.tools;
  }

  async listResources(): Promise<Array<{ uri: string; description?: string }>> {
    const r = await this.rpc<{ resources: any[] }>("resources/list", {});
    return r.resources;
  }

  async readResource(uri: string): Promise<string> {
    const r = await this.rpc<{ contents: Array<{ text: string }> }>("resources/read", { uri });
    return r.contents?.[0]?.text ?? "";
  }

  async listPrompts(): Promise<Array<{ name: string; description?: string; arguments?: any[] }>> {
    const r = await this.rpc<{ prompts: any[] }>("prompts/list", {});
    return r.prompts;
  }

  async close(): Promise<void> {
    this.child.kill();
    await new Promise((r) => setTimeout(r, 100));
  }
}
