import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { installed, JSON_HEADERS, startServer, type TestServer } from "./helpers";

/** A run starts the fake CLI and the MCP host: a few seconds each, more on a busy machine */
const RUN_TIMEOUT_MS = 30_000;
const needed = ["chat", "drafts", "people", "calendar"].every(installed);

describe.skipIf(!needed)("background draft runs", () => {
  let server: TestServer;
  let personId: number;
  beforeAll(async () => {
    process.env.FF_CLAUDE_CLI = path.resolve(__dirname, "../test-fixtures/fake-claude.cjs");
    process.env.FF_CHAT_CWD = fs.mkdtempSync(path.join(os.tmpdir(), "ff-draft-cwd-"));
    server = await startServer();
    personId = (await server.request("/api/people", { method: "POST", ...json({ name: "Ayşe Taslak" }) })).json.row.id;
  });
  afterAll(async () => {
    for (const k of ["FF_CLAUDE_CLI", "FF_CHAT_CWD"]) delete process.env[k];
    await server.close();
  });

  function json(body: unknown) {
    return { headers: JSON_HEADERS, body: JSON.stringify(body) };
  }
  const ask = (body: unknown) => server.request("/api/draft-runs", { method: "POST", ...json(body) });
  async function settle(id: number) {
    let run: { state: string } = { state: "queued" };
    for (let i = 0; i < 150 && (run.state === "queued" || run.state === "running"); i++) {
      await new Promise((r) => setTimeout(r, 100));
      run = (await server.request(`/api/draft-runs/${id}`)).json;
    }
    return run as { state: string; draft_id: number | null; error: string | null; session_id: number; task_id: number | null };
  }
  const replyOf = async (sessionId: number) =>
    (await server.request(`/api/chat/sessions/${sessionId}/messages`)).json.items.find((x: { role: string }) => x.role === "assistant");

  it("queues a request, returns the same run for a second press, and saves one draft with only the read tools and draft", { timeout: RUN_TIMEOUT_MS }, async () => {
    const first = await ask({ title: "Ayşe için mesaj taslağı hazırla", person_id: personId });
    expect(first.status, first.body).toBe(201);
    expect(first.json.mode).toBe("run");
    const twin = await ask({ title: "Ayşe için mesaj taslağı hazırla", person_id: personId });
    expect(twin.json.run.id).toBe(first.json.run.id);

    const run = await settle(first.json.run.id);
    expect(run.state, run.error ?? "").toBe("done");
    const draft = (await server.request(`/api/drafts/${run.draft_id}`)).json.row;
    expect(draft).toMatchObject({ person_id: personId, created_by: "claude", status: "bekliyor" });

    const session = (await server.request(`/api/chat/sessions/${run.session_id}`)).json;
    expect(session).toMatchObject({ kind: "draft", title: "Taslak: Ayşe Taslak", model: "claude-sonnet-5-5" });
    // the fake CLI asked the MCP host the draft config starts: delete was refused by the allowlist and does not exist in the host
    const summary = JSON.parse((await replyOf(run.session_id)).body);
    expect(summary).toEqual({ tools: ["draft", "find", "get", "timeline"], deleteViaCli: "cli", deleteViaMcp: "refused", readOk: true, saved: true });

    const task = (await server.request(`/api/tasks/${run.task_id}`)).json.row;
    expect(task).toMatchObject({ assignee: "claude", done_at: expect.any(String) });
  });

  it("runs one request at a time: the second waits queued while the first runs", { timeout: RUN_TIMEOUT_MS }, async () => {
    const a = (await ask({ title: "Sıra A taslağı", person_id: personId })).json.run;
    const b = (await ask({ title: "Sıra B taslağı", person_id: personId })).json.run;
    expect(a.state).toBe("running");
    expect(b.state).toBe("queued");
    expect((await settle(a.id)).state).toBe("done");
    expect((await settle(b.id)).state).toBe("done");
  });

  it("marks a failed run with the reason and removes its task, so the button can ask again", { timeout: RUN_TIMEOUT_MS }, async () => {
    const failed = await settle((await ask({ title: "FAIL taslağı", person_id: personId })).json.run.id);
    expect(failed.state).toBe("failed");
    expect(failed.error).toBeTruthy();
    expect((await server.request(`/api/tasks/${failed.task_id}`)).status).toBe(404);

    const emptyId = (await ask({ title: "NODRAFT taslağı", person_id: personId })).json.run.id;
    expect(await settle(emptyId)).toMatchObject({ state: "failed", error: "Claude taslak kaydetmeden bitirdi" });
    // a failed request is not a twin: the same press starts a new run
    const again = await ask({ title: "NODRAFT taslağı", person_id: personId });
    expect(again.json.mode).toBe("run");
    expect(again.json.run.id).not.toBe(emptyId);
    await settle(again.json.run.id);
  });

  it("becomes Claude's task when auto drafting is off", async () => {
    expect((await server.request("/api/settings", { method: "PUT", ...json({ draft_auto: false }) })).status).toBe(200);
    const r = await ask({ title: "Kapalıyken taslak", person_id: personId });
    expect(r.json).toMatchObject({ mode: "task", task: { title: "Kapalıyken taslak", assignee: "claude", person_id: personId, done_at: null } });
    await server.request("/api/settings", { method: "PUT", ...json({ draft_auto: true }) });
  });
});
