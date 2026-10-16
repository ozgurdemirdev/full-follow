import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createCore, createRegistry, openDb, type ChatAccess, type ChatApi, type Clock, type Ctx } from "@fullfollow/core";
import chat from "../src";
import { awaitAnswer } from "../src/mcp";
import { decide } from "../src/service/permission-policy";

// the data folder is the folder of FF_DB: a throwaway one, apart from the folders the tests allow
process.env.FF_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ff-perm-data-")), "test.db");

const clock: Clock = { today: () => "2026-10-16", now: () => "2026-10-16T10:00:00Z" };
const OFF: ChatAccess = { chat_full_access: false, chat_web_fetch: false, chat_local_files: false, chat_local_folders: [] };
const FF = (tool: string) => `mcp__full-follow__${tool}`;

describe("what the panel chat may run, refuse or ask", () => {
  let ctx: Ctx;
  let sql: (q: string, ...a: unknown[]) => void;
  beforeEach(() => {
    const h = openDb(":memory:");
    ctx = createCore(h, "claude", clock, createRegistry([chat])).ctx;
    sql = (q, ...a) => void h.sqlite.prepare(q).run(...a);
  });

  it("asks before a delete, a payment and a setting write, and runs the other writes and every read", () => {
    sql("INSERT INTO people (name, created_at, updated_at, created_by) VALUES ('Ayşe', 'x', 'x', 'owner')");
    sql("INSERT INTO projects (name, person_id, created_at, updated_at, created_by) VALUES ('Site', 1, 'x', 'x', 'owner')");
    sql("INSERT INTO payments (project_id, milestone, expected_amount, created_at, updated_at, created_by) VALUES (1, 'pesinat', 30000, 'x', 'x', 'owner')");
    expect(decide(ctx, FF("delete"), { type: "tag", id: 3 }, OFF)).toEqual({ kind: "ask", summary: "Tag #3 silinecek" });
    const pay = decide(ctx, FF("pay"), { payment_id: 1, amount: 15000, date: "2026-10-16" }, OFF);
    expect(pay.kind).toBe("ask");
    expect(pay.kind === "ask" && pay.summary).toMatch(/15\.000.*ödeme girilecek: Site, pesinat \(ödeme #1\), tarih 2026-10-16/);
    expect(decide(ctx, FF("save"), { type: "ayar", data: { weekly_target: 20 } }, OFF)).toEqual({ kind: "ask", summary: "Ayar değişecek: weekly_target → 20" });
    for (const [tool, input] of [["save", { type: "person", data: { name: "Ali" } }], ["draft", { person: 1, body: "x" }], ["touch", {}], ["move", {}], ["find", {}], ["delete", { type: "person", id: 1, restore: true }]] as const) {
      expect(decide(ctx, FF(tool), input, OFF), tool).toEqual({ kind: "allow" });
    }
  });

  it("refuses an owner only setting at once instead of asking for something core will refuse", () => {
    const d = decide(ctx, FF("save"), { type: "setting", data: { chat_full_access: true } }, OFF);
    expect(d).toEqual({ kind: "deny", message: expect.stringMatching(/Only the owner can change chat_full_access/) });
  });

  it("asks nothing with full authority", () => {
    const full = { ...OFF, chat_full_access: true };
    for (const [tool, input] of [["delete", { type: "tag", id: 3 }], ["pay", { payment_id: 1, amount: 5 }], ["save", { type: "setting", data: { weekly_target: 1 } }]] as const) {
      expect(decide(ctx, FF(tool), input, full), tool).toEqual({ kind: "allow" });
    }
  });

  it("keeps the file tools inside the allowed folders: outside refused, a new file created, an existing one asks, Bash never", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ff-perm-files-"));
    const other = fs.mkdtempSync(path.join(os.tmpdir(), "ff-perm-other-"));
    const existing = path.join(dir, "teklif.md");
    fs.writeFileSync(existing, "eski");
    const on = { ...OFF, chat_local_files: true, chat_local_folders: [dir] };
    expect(decide(ctx, "Read", { file_path: existing }, OFF)).toEqual({ kind: "deny", message: expect.any(String) });
    expect(decide(ctx, "Read", { file_path: path.join(other, "a.txt") }, on)).toEqual({ kind: "deny", message: expect.stringMatching(/outside the folders/) });
    expect(decide(ctx, "Glob", { pattern: "*" }, on).kind).toBe("deny");
    expect(decide(ctx, "Read", { file_path: existing }, on)).toEqual({ kind: "allow" });
    expect(decide(ctx, "Write", { file_path: path.join(dir, "yeni.md"), content: "x" }, on)).toEqual({ kind: "allow" });
    expect(decide(ctx, "Write", { file_path: existing, content: "x" }, on)).toEqual({ kind: "ask", summary: expect.stringMatching(/üzerine yazılacak/) });
    expect(decide(ctx, "Edit", { file_path: existing, old_string: "eski", new_string: "yeni" }, on)).toEqual({ kind: "ask", summary: expect.stringMatching(/Dosya değiştirilecek/) });
    expect(decide(ctx, "Edit", { file_path: path.join(dir, "..", path.basename(other), "a.txt") }, on).kind).toBe("deny");
    expect(decide(ctx, "Edit", { file_path: existing }, { ...on, chat_full_access: true })).toEqual({ kind: "allow" });
    expect(decide(ctx, "Bash", { command: "dir" }, { ...on, chat_full_access: true }).kind).toBe("deny");
  });
});

describe("confirmation rows", () => {
  let owner: ChatApi;
  let claude: ChatApi;
  let session: number;
  beforeEach(() => {
    const h = openDb(":memory:");
    owner = createCore(h, "owner", clock, createRegistry([chat])).mod("chat")!;
    claude = createCore(h, "claude", clock, createRegistry([chat])).mod("chat")!;
    session = owner.createSession().id;
  });

  it("hang on the running reply and only the owner answers them", () => {
    owner.addUserMessage(session, { body: "sil", client_id: "c1" });
    const reply = owner.startAssistantMessage(session);
    const row = claude.permissions.ask(session, "mcp__full-follow__delete", { type: "person", id: 1 }, "Kişi #1 silinecek");
    expect(row).toMatchObject({ state: "pending", message_id: reply.id, created_by: "claude" });
    expect(() => claude.permissions.answer(row.id, true)).toThrow(/sadece kullanıcı/);
    expect(owner.permissions.answer(row.id, true).state).toBe("allowed");
    expect(() => owner.permissions.answer(row.id, false)).toThrow(/artık beklemiyor/);
  });

  it("an unanswered one is refused at the deadline, and a late answer is refused too", async () => {
    const row = claude.permissions.ask(session, "mcp__full-follow__pay", {}, "x");
    expect(await awaitAnswer(claude.permissions, row.id, { timeoutMs: 30, answerPollMs: 5 })).toBe("expired");
    expect(() => owner.permissions.answer(row.id, true)).toThrow(/artık beklemiyor/);
  });

  it("the waiting host sees the owner's answer", async () => {
    const row = claude.permissions.ask(session, "mcp__full-follow__pay", {}, "x");
    setTimeout(() => owner.permissions.answer(row.id, false), 20);
    expect(await awaitAnswer(claude.permissions, row.id, { timeoutMs: 2_000, answerPollMs: 5 })).toBe("denied");
  });

  it("the end of a run cancels what it left open, of its own session only", () => {
    const other = owner.createSession().id;
    const a = claude.permissions.ask(session, "x", {}, "a");
    const b = claude.permissions.ask(other, "x", {}, "b");
    expect(owner.permissions.cancel(session).map((r) => r.id)).toEqual([a.id]);
    expect(owner.permissions.pending().map((r) => r.id)).toEqual([b.id]);
    expect(owner.permissions.ofSession(session)[0].state).toBe("cancelled");
  });
});
