import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { installed, JSON_HEADERS, startServer, type TestServer } from "./helpers";

/** A run starts the fake CLI and the MCP host: a few seconds each, more on a busy machine */
const RUN_TIMEOUT_MS = 40_000;
const POLL_MS = 100;
const POLLS = 300;
const needed = ["chat", "people"].every(installed);

interface Outcome { tool: string; outcome: string; message?: string; text?: string }

describe.skipIf(!needed)("confirmations of the panel chat (fake CLI)", () => {
  let server: TestServer;
  beforeAll(async () => {
    process.env.FF_CLAUDE_CLI = path.resolve(__dirname, "../test-fixtures/fake-claude.cjs");
    process.env.FF_CHAT_CWD = fs.mkdtempSync(path.join(os.tmpdir(), "ff-perm-cwd-"));
    server = await startServer();
  });
  afterAll(async () => {
    for (const k of ["FF_CLAUDE_CLI", "FF_CHAT_CWD"]) delete process.env[k];
    await server.close();
  });

  const json = (method: string, body: unknown) => ({ method, headers: JSON_HEADERS, body: JSON.stringify(body) });
  const wait = () => new Promise((r) => setTimeout(r, POLL_MS));
  const settings = (body: Record<string, unknown>) => server.request("/api/settings", json("PUT", body));
  const person = async (name: string) => (await server.request("/api/people", json("POST", { name }))).json.row.id as number;

  /** A new chat that sends `calls` (lines `CALL <tool> <json>`); the fake CLI answers with the outcome of each call */
  async function ask(calls: [string, unknown][]) {
    const session = (await server.request("/api/chat/sessions", json("POST", {}))).json.id as number;
    const body = calls.map(([tool, input]) => `CALL ${tool} ${JSON.stringify(input)}`).join("\n");
    const sent = await server.request(`/api/chat/sessions/${session}/messages`, json("POST", { body, client_id: `c${session}` }));
    expect(sent.status, sent.body).toBe(202);
    return session;
  }
  async function card(session: number) {
    for (let i = 0; i < POLLS; i++) {
      const row = (await server.request(`/api/chat/sessions/${session}/permissions`)).json.rows.find((r: { state: string }) => r.state === "pending");
      if (row) return row as { id: number; summary: string; tool_name: string; message_id: number };
      await wait();
    }
    throw new Error("no confirmation card");
  }
  async function outcomes(session: number): Promise<Outcome[]> {
    for (let i = 0; i < POLLS; i++) {
      const reply = (await server.request(`/api/chat/sessions/${session}/messages`)).json.items.find((x: { role: string }) => x.role === "assistant");
      if (reply?.state === "done") return JSON.parse(reply.body);
      if (reply?.state === "error") throw new Error(reply.error);
      await wait();
    }
    throw new Error("no reply");
  }
  const answer = (id: number, allow: boolean) => server.request(`/api/chat/permissions/${id}`, json("POST", { allow }));

  it("a delete waits for the card; Onayla runs it", { timeout: RUN_TIMEOUT_MS }, async () => {
    const id = await person("Silinecek Kişi");
    const session = await ask([["delete", { type: "person", id }]]);
    const c = await card(session);
    expect(c.summary).toBe(`Kişi silinecek: Silinecek Kişi (#${id})`);
    expect(c.tool_name).toBe("mcp__full-follow__delete");
    expect((await answer(c.id, true)).json.state).toBe("allowed");
    expect((await outcomes(session))[0]).toMatchObject({ outcome: "ran" });
    expect((await server.request(`/api/people/${id}`)).status).toBe(404);
  });

  it("Vazgeç refuses it, Claude is told, the record stays", { timeout: RUN_TIMEOUT_MS }, async () => {
    const id = await person("Kalacak Kişi");
    const session = await ask([["delete", { type: "person", id }]]);
    const c = await card(session);
    await answer(c.id, false);
    expect((await outcomes(session))[0]).toMatchObject({ outcome: "denied", message: expect.stringMatching(/refused this action/) });
    expect((await server.request(`/api/people/${id}`)).status).toBe(200);
    // a settled card cannot be answered again
    expect((await answer(c.id, true)).status).not.toBe(200);
  });

  it("local files: a read outside the folders is refused, Bash does not exist, a new file is written, an edit asks", { timeout: RUN_TIMEOUT_MS }, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ff-perm-folder-"));
    const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ff-perm-outside-")), "gizli.txt");
    fs.writeFileSync(outside, "gizli");
    const existing = path.join(dir, "teklif.md");
    fs.writeFileSync(existing, "fiyat 100");
    const put = await settings({ chat_local_files: true, chat_local_folders: [dir] });
    expect(put.status, put.body).toBe(200);
    const session = await ask([
      ["Read", { file_path: outside }],
      ["Bash", { command: "type secret" }],
      ["Write", { file_path: path.join(dir, "yeni.md"), content: "yeni" }],
      ["Edit", { file_path: existing, old_string: "100", new_string: "200" }],
    ]);
    const c = await card(session);
    expect(c.summary).toContain("Dosya değiştirilecek");
    await answer(c.id, true);
    const [read, bash, write, edit] = await outcomes(session);
    expect(read).toMatchObject({ outcome: "denied", message: expect.stringMatching(/outside the folders/) });
    expect(bash.outcome).toBe("unavailable");
    expect(write.outcome).toBe("ran");
    expect(fs.readFileSync(path.join(dir, "yeni.md"), "utf8")).toBe("yeni");
    expect(edit.outcome).toBe("ran");
    expect(fs.readFileSync(existing, "utf8")).toBe("fiyat 200");
    await settings({ chat_local_files: false, chat_local_folders: [] });
  });

  it("with full authority nothing asks", { timeout: RUN_TIMEOUT_MS }, async () => {
    await settings({ chat_full_access: true });
    const id = await person("Sorulmadan Silinen");
    const session = await ask([["delete", { type: "person", id }]]);
    expect((await outcomes(session))[0]).toMatchObject({ outcome: "ran" });
    expect((await server.request(`/api/chat/sessions/${session}/permissions`)).json.rows).toEqual([]);
    await settings({ chat_full_access: false });
  });
});
