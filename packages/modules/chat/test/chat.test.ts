import { beforeEach, describe, expect, it } from "vitest";
import { createCore, createRegistry, openDb, type ChatApi, type Clock } from "@fullfollow/core";
import chat from "../src";

describe("Panel chat", () => {
  const clock: Clock = { today: () => "2026-10-11", now: () => "2026-10-11T10:00:00Z" };
  let c: { chat: ChatApi };
  let sql: <T = any>(q: string, ...a: unknown[]) => T[];
  beforeEach(() => {
    const h = openDb(":memory:");
    c = { chat: createCore(h, "ozgur", clock, createRegistry([chat])).mod("chat")! };
    sql = (q, ...a) => h.sqlite.prepare(q).all(...a) as any[];
  });

  it("23. aynı client_id iki kez gelirse aynı satır döner, bir kez eklenir", () => {
    const s = c.chat.createSession();
    const a = c.chat.addUserMessage(s.id, { body: "merhaba", client_id: "abc" });
    const b = c.chat.addUserMessage(s.id, { body: "merhaba", client_id: "abc" });
    expect(b.id).toBe(a.id);
    expect(sql("SELECT id FROM chat_messages WHERE session_id = ?", s.id)).toHaveLength(1);
  });

  it("24. mesaj sayfalama: 45 satır, limit 20 → 20, 20, 5; boşluk ve tekrar yok", () => {
    const s = c.chat.createSession();
    for (let i = 0; i < 45; i++) c.chat.addUserMessage(s.id, { body: `m${i}`, client_id: `c${i}` });
    const seen: number[] = [];
    let before: number | undefined;
    const sizes: number[] = [];
    const flags: boolean[] = [];
    for (;;) {
      const p = c.chat.listMessages(s.id, { before, limit: 20 });
      sizes.push(p.items.length);
      flags.push(p.has_more);
      seen.unshift(...p.items.map((m) => m.id));
      if (!p.has_more) break;
      before = p.items[0].id;
    }
    expect(sizes).toEqual([20, 20, 5]);
    expect(flags).toEqual([true, true, false]);
    expect(new Set(seen).size).toBe(45);
    expect(seen).toEqual([...seen].sort((x, y) => x - y));
  });

  it("25. bitiş kullanımı oturum toplamına tam bir kez eklenir", () => {
    const s = c.chat.createSession();
    const m = c.chat.startAssistantMessage(s.id);
    const fin = { state: "done", usage: { input_tokens: 100, output_tokens: 40 }, cost_usd: 0.32, context_tokens: 5000 };
    c.chat.finishAssistantMessage(m.id, fin);
    c.chat.finishAssistantMessage(m.id, fin);
    const row = c.chat.getSession(s.id);
    expect([row.input_tokens_total, row.output_tokens_total, row.cost_usd_micros_total, row.context_tokens]).toEqual([100, 40, 320_000, 5000]);
  });

  it("26. failDanglingRuns sadece pending ve streaming asistan satırlarına dokunur", () => {
    const s = c.chat.createSession();
    const user = c.chat.addUserMessage(s.id, { body: "x", client_id: "u1" });
    const pending = c.chat.startAssistantMessage(s.id);
    const streaming = c.chat.startAssistantMessage(s.id);
    c.chat.appendAssistantText(streaming.id, "yarım");
    const done = c.chat.startAssistantMessage(s.id);
    c.chat.finishAssistantMessage(done.id, { state: "done" });
    expect(c.chat.failDanglingRuns("restart")).toBe(2);
    const state = (id: number) => c.chat.getMessage(id).state;
    expect([state(user.id), state(pending.id), state(streaming.id), state(done.id)]).toEqual(["done", "error", "error", "done"]);
    expect(c.chat.getMessage(streaming.id).body).toBe("yarım");
  });

  it("27. otomatik başlık ilk mesajdan gelir, elle adlandırmadan sonra değişmez", () => {
    const s = c.chat.createSession();
    c.chat.addUserMessage(s.id, { body: "bugün kime yazmalıyım ve hangi firmanın durumu değişti acaba söyler misin lütfen", client_id: "a" });
    const t = c.chat.getSession(s.id).title;
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.startsWith("bugün kime yazmalıyım")).toBe(true);
    const s2 = c.chat.createSession();
    c.chat.updateSession(s2.id, { title: "Benim adım" });
    c.chat.addUserMessage(s2.id, { body: "ilk mesaj", client_id: "b" });
    expect(c.chat.getSession(s2.id).title).toBe("Benim adım");
  });

  it("28. silinen sohbet çöp kutusunda görünür ve çekirdeğin restore'u ile geri gelir; modül yokken çöp kutusunda yok", () => {
    const h = openDb(":memory:");
    const core = createCore(h, "ozgur", clock, createRegistry([chat]));
    const s = core.mod("chat")!.createSession();
    expect(core.mod("chat")!.deleteSession(s.id).trash).toEqual({ type: "chat_session", id: s.id });
    expect(core.trash.list()).toEqual([expect.objectContaining({ type: "chat_session", id: s.id, what: "sohbet", trash_id: null })]);
    expect(core.restore("chat_session", s.id)).toMatchObject({ label: "Yeni sohbet" });
    expect(core.trash.list()).toEqual([]);
    const bare = createCore(h, "ozgur", clock);
    core.mod("chat")!.deleteSession(s.id);
    expect(bare.trash.list()).toEqual([]);
    expect(() => bare.restore("chat_session", s.id)).toThrow(/bilinmeyen tür "chat_session"/);
  });
});
