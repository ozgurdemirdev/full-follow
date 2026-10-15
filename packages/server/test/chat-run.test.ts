import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JSON_HEADERS, startServer, type TestServer } from "./helpers";

let server: TestServer;
beforeAll(async () => {
  process.env.FF_CLAUDE_CLI = path.resolve(__dirname, "../test-fixtures/fake-claude.cjs");
  process.env.FF_CHAT_CWD = fs.mkdtempSync(path.join(os.tmpdir(), "ff-chat-cwd-"));
  process.env.FF_COOKIE_SECRET = "server-secret-that-must-not-leak";
  process.env.ANTHROPIC_API_KEY = "sk-test-not-real";
  server = await startServer();
});
afterAll(async () => {
  for (const k of ["FF_CLAUDE_CLI", "FF_CHAT_CWD", "FF_COOKIE_SECRET", "ANTHROPIC_API_KEY"]) delete process.env[k];
  await server.close();
});

const json = (body: unknown) => ({ headers: JSON_HEADERS, body: JSON.stringify(body) });

describe("a chat run", () => {
  it("starts the CLI with the allowlisted environment: the sign-in and PATH reach it, the server's secrets do not", async () => {
    const session = (await server.request("/api/chat/sessions", { method: "POST", ...json({}) })).json;
    const sent = await server.request(`/api/chat/sessions/${session.id}/messages`, { method: "POST", ...json({ body: "merhaba", client_id: "c1" }) });
    expect(sent.status, sent.body).toBe(202);

    let reply: { state: string; body: string } | undefined;
    for (let i = 0; i < 100 && reply?.state !== "done"; i++) {
      await new Promise((r) => setTimeout(r, 100));
      reply = (await server.request(`/api/chat/sessions/${session.id}/messages`)).json.items.find((x: { role: string }) => x.role === "assistant");
    }
    expect(reply?.state).toBe("done");
    expect(JSON.parse(reply!.body)).toMatchObject({ PATH: true, ANTHROPIC_API_KEY: true, FF_COOKIE_SECRET: false, FF_PASSWORD: false, FF_DB: false });
  });

  it("keeps the runtime files next to the database in use, not in the shared data folder", () => {
    expect(fs.existsSync(path.join(server.dir, "chat", "system.md"))).toBe(true);
    expect(fs.existsSync(path.join(server.dir, "chat", "mcp.json"))).toBe(true);
  });
});
