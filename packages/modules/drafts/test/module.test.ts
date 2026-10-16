import { describe, expect, it } from "vitest";
import { Bin, defineModule, DRAFT_RULES_MAX, FFError, openDb, type Clock, type RecordTrashed, type TouchCreated } from "@fullfollow/core";
import { appFor, person, touch } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };
const at = (day: string) => `${day}T09:00:00Z`;

/** Stand-in for the network module: it writes a bare touch row for the draft being sent */
const fakeNetwork = () => defineModule({
  key: "network",
  label: "N",
  api: (ctx) => ({
    touches: {
      insert: (_q: unknown, i: { draft_id: number; person_id: number | null; summary: string; channel: string }) => {
        const id = Number(ctx.sqlite.prepare(`INSERT INTO touches (person_id, channel, direction, kind, summary, happened_at, draft_id, created_at, updated_at, created_by)
          VALUES (?, ?, 'giden', 'mesaj', ?, ?, ?, ?, ?, 'owner')`).run(i.person_id, i.channel, i.summary, ctx.clock.now(), i.draft_id, ctx.clock.now(), ctx.clock.now()).lastInsertRowid);
        return { row: { id, draft_id: i.draft_id }, effects: ["probe: temas yazıldı"] };
      },
    },
  }),
});

describe("drafts as a module", () => {
  it("drafts go through the generic save, find, get and delete by their Turkish alias; only a waiting draft is edited", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "claude", clock);
    const ada = person(h);
    const d = app.save("taslak", { person_id: ada, channel: "email", body: "Merhaba", reason: "neden" }).row;
    expect(app.get("draft", d.id).row).toMatchObject({ status: "bekliyor", person_name: "Ada", to_name: "Ada", created_by: "claude", reason: "neden" });
    expect(app.find("draft", { filter: { status: "bekliyor" } }).total).toBe(1);
    expect(app.find("draft", { q: "merha" }).total).toBe(1);
    expect(app.find("draft", { filter: { person_id: ada } }).total).toBe(1);
    expect(app.save("draft", { body: "Selam" }, d.id).row.body).toBe("Selam");
    const owner = appFor(h, "owner", clock);
    owner.drafts.approve(d.id);
    expect(() => owner.drafts.update(d.id, { body: "x" })).toThrow(/sadece bekleyen taslak düzenlenir/);
    expect(() => owner.drafts.approve(d.id)).toThrow(/"onaylandi" durumunda/);
    expect(app.remove("draft", d.id).trash).toEqual({ type: "draft", id: d.id });
    expect(app.find("trash").rows[0]).toMatchObject({ type: "draft", what: "taslak" });
    app.restore("draft", d.id);
    expect(app.get("draft", d.id).row.status).toBe("onaylandi");
    expect(() => app.get("draft", 999)).toThrow(/draft #999 bulunamadı/);
  });

  it("a reject note becomes a learned rule in the same step: a repeat is skipped, the list keeps the newest, Today and the settings carry it, the settings can drop one", () => {
    const h = openDb(":memory:");
    const claude = appFor(h, "claude", clock);
    const owner = appFor(h, "owner", clock);
    const ada = person(h);
    const reject = (note: string) => owner.drafts.reject(claude.drafts.create({ person_id: ada, channel: "email", body: "x" }).row.id, note);
    expect(owner.today(5)).not.toHaveProperty("draft_rules");
    reject("  çok uzun  ");
    reject("çok uzun");
    reject("resmi yazma");
    // a reject without a reason (the explicit flag) keeps its note on the draft but teaches nothing; no text is matched to tell it apart
    const bare = claude.drafts.create({ person_id: ada, channel: "email", body: "x" }).row.id;
    expect(owner.drafts.reject(bare, { no_reason: true }).row.reject_note).toBe("Neden yazılmadı");
    expect(() => owner.drafts.reject(claude.drafts.create({ person_id: ada, channel: "email", body: "x" }).row.id, {})).toThrow(/ret nedeni gerekli/);
    expect(owner.settings.view().draft_rules).toEqual(["çok uzun", "resmi yazma"]);
    expect(owner.today(5).draft_rules).toEqual(["çok uzun", "resmi yazma"]);
    expect(h.sqlite.prepare("SELECT COUNT(*) n FROM events WHERE type = 'draft.rejected'").get()).toEqual({ n: 4 });
    // the same words typed as a real reason are a reason like any other
    reject("Neden yazılmadı");
    expect(owner.settings.view().draft_rules).toEqual(["çok uzun", "resmi yazma", "Neden yazılmadı"]);
    owner.settings.set("draft_rules", ["çok uzun", "resmi yazma"]);
    for (let i = 0; i < DRAFT_RULES_MAX; i++) reject(`kural ${i}`);
    const kept = owner.settings.view().draft_rules as string[];
    expect(kept).toHaveLength(DRAFT_RULES_MAX);
    expect(kept[0]).toBe("kural 0");
    owner.settings.setMany({ draft_rules: kept.slice(1) });
    expect((owner.settings.view().draft_rules as string[])[0]).toBe("kural 1");
    expect(() => owner.settings.setMany({ draft_rules: ["a", "a"] })).toThrow(/farklı/);
    // a reject that fails (the draft is already rejected) leaves the list alone
    const done = claude.drafts.create({ person_id: ada, channel: "email", body: "y" }).row.id;
    owner.drafts.reject(done, "yeni kural");
    expect(() => owner.drafts.reject(done, "olmaz")).toThrow(/durumunda/);
    expect(owner.settings.view().draft_rules).not.toContain("olmaz");
  });

  it("the drafts of an opportunity or a project are listed by that link only", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "claude", clock);
    const ada = person(h);
    const [a, b, c] = [1, 2, 3].map((n) => app.save("draft", { person_id: ada, channel: "email", body: `d${n}` }).row.id);
    // the opportunity and project rows are not needed for what the list reads
    h.sqlite.pragma("foreign_keys = OFF");
    h.sqlite.prepare("UPDATE drafts SET opportunity_id = 7 WHERE id = ?").run(a);
    h.sqlite.prepare("UPDATE drafts SET project_id = 9 WHERE id = ?").run(b);
    expect(app.find("draft", { filter: { opportunity_id: 7 } }).rows.map((d) => d.id)).toEqual([a]);
    expect(app.find("draft", { filter: { project_id: "9" } }).rows.map((d) => d.id)).toEqual([b]);
    expect(app.find("draft", { filter: { opportunity_id: 8 } }).total).toBe(0);
    expect(app.find("draft", {}).rows.map((d) => d.id)).toEqual([c, b, a]);
  });

  it("approving, rejecting and marking sent are the owner's; a rejection needs its note", () => {
    const h = openDb(":memory:");
    const claude = appFor(h, "claude", clock);
    const owner = appFor(h, "owner", clock);
    const d = claude.drafts.create({ contact: "a@x.example", channel: "email", body: "x" }).row;
    expect(() => claude.drafts.approve(d.id)).toThrow(/sadece kullanıcı/);
    expect(() => claude.drafts.reject(d.id, "no")).toThrow(/sadece kullanıcı/);
    expect(() => claude.drafts.markSent(d.id)).toThrow(/sadece kullanıcı/);
    expect(() => owner.drafts.reject(d.id, "  ")).toThrow(/ret nedeni gerekli/);
    expect(owner.drafts.reject(d.id, "olmamış").row).toMatchObject({ status: "reddedildi", reject_note: "olmamış" });
    expect(() => owner.drafts.markSent(d.id)).toThrow(/Taslak zaten reddedildi/);
    expect(h.sqlite.prepare("SELECT type FROM events ORDER BY id").all().map((e: any) => e.type)).toEqual(["draft.created", "draft.rejected", "settings.updated"]);
  });

  it("marking a draft as sent writes the touch through the network module in the same transaction; without it the draft is only marked", () => {
    const h = openDb(":memory:");
    const bare = appFor(h, "owner", clock);
    const ada = person(h);
    const alone = bare.drafts.create({ person_id: ada, channel: "email", body: "x" }).row;
    const sent = bare.drafts.markSent(alone.id);
    expect(sent.touch).toBeUndefined();
    expect(sent.effects).toEqual([]);
    expect(sent.row.status).toBe("gonderildi");
    expect(() => bare.drafts.remove(alone.id)).toThrow(/Gönderilmiş taslak silinemez/);

    const app = appFor(h, "owner", clock, [fakeNetwork()]);
    const d = app.drafts.create({ person_id: ada, channel: "instagram", body: "merhaba" }).row;
    const r = app.drafts.markSent(d.id);
    expect(r.touch!.draft_id).toBe(d.id);
    expect(r.effects).toEqual([`temas #${r.touch!.id} oluştu`, "probe: temas yazıldı"]);
    expect(h.sqlite.prepare("SELECT type FROM events WHERE type = 'draft.sent'").all()).toHaveLength(2);
  });

  it("the recipient is a person, a company or an address; links to other modules are refused clearly while they are not installed", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "claude", clock);
    const ada = person(h);
    expect(() => app.drafts.create({ channel: "email", body: "x" })).toThrow(/kişi, firma ya da adres/);
    expect(() => app.drafts.create({ contact: "a@x.example", channel: "email", body: "x", opportunity_id: 1 })).toThrow(/sadece kişiye yazılan taslakta/);
    expect(() => app.drafts.create({ person_id: ada, channel: "email", body: "x", opportunity_id: 1 })).toThrow(/"pipeline" modülü kurulu değil/);
    expect(() => app.drafts.create({ person_id: ada, channel: "email", body: "x", project_id: 1 })).toThrow(/"projects" modülü kurulu değil/);
    expect(() => app.drafts.create({ person_id: ada, channel: "email" })).toThrow(/taslak metni ya da şablon gerekli/);
    expect(() => app.drafts.create({ person_id: ada, channel: "email", template_id: 3 })).toThrow(/"templates" modülü kurulu değil/);
    expect(() => app.drafts.create({ person_id: 999, channel: "email", body: "x" })).toThrow(FFError);
    // an opportunity of somebody else is refused (stand-in for the pipeline module)
    const pipeline = defineModule({ key: "pipeline", label: "O", api: () => ({ opportunities: { ref: (id: number) => (id === 1 ? { id, person_id: ada, title: "T" } : id === 2 ? { id, person_id: 999, title: "U" } : undefined) } }) });
    const withPipeline = appFor(h, "claude", clock, [pipeline]);
    expect(() => withPipeline.drafts.create({ person_id: ada, channel: "email", body: "x", opportunity_id: 2 })).toThrow(/bu kişiye ya da firmasına ait değil/);
    expect(() => withPipeline.drafts.create({ person_id: ada, channel: "email", body: "x", opportunity_id: 3 })).toThrow(/fırsat #3 bulunamadı/);
  });

  it("the daily quota counts outgoing messages per limited channel and a touch over the limit (or a cold email in warmup) warns without blocking", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "owner", clock);
    app.settings.setMany({ channel_limits: { email: 2, instagram: 1 }, email_warmup_until: "2026-10-20" });
    touch(h, { contact: "a@x.example", at: at("2026-10-14") });
    touch(h, { contact: "b@x.example", at: at("2026-10-14") });
    touch(h, { contact: "c@x.example", channel: "instagram", at: at("2026-10-14") });
    touch(h, { contact: "d@x.example", kind: "arama", at: at("2026-10-14") });
    touch(h, { contact: "e@x.example", at: at("2026-10-13") });
    expect(app.drafts.quota()).toEqual({
      date: "2026-10-14",
      channels: [{ channel: "email", sent: 2, limit: 2, state: "over" }, { channel: "instagram", sent: 1, limit: 1, state: "over" }],
      email_warmup: { until: "2026-10-20", active: true },
    });
    expect(app.drafts.quota("2026-10-13").channels).toEqual([{ channel: "email", sent: 1, limit: 2, state: "ok" }, { channel: "instagram", sent: 0, limit: 1, state: "ok" }]);
    expect(app.drafts.quotaOverDays("2026-10-12", "2026-10-14")).toEqual([{ channel: "email", limit: 2, over_days: 1, max_sent: 2 }, { channel: "instagram", limit: 1, over_days: 1, max_sent: 1 }]);
    expect([...app.drafts.outgoingMessageCounts("2026-10-13", "2026-10-14")]).toEqual(expect.arrayContaining([["email|2026-10-14", 2], ["email|2026-10-13", 1], ["instagram|2026-10-14", 1]]));

    const emit = (day: string, cold: boolean, channel = "email") => h.sqlite.transaction(() => app.ctx.emit("touch.created", {
      touch: { happened_at: `${day}T09:00:00Z` }, subject: {}, cold, input: { channel, direction: "giden", kind: "mesaj" },
    } as TouchCreated))();
    expect(emit("2026-10-14", true)).toEqual(["Uyarı: e-posta günlük limiti doldu (2/2)", "Uyarı: soğuk e-posta ısınma döneminde kapalı (20.10 tarihine kadar)"]);
    expect(emit("2026-10-14", false)).toEqual(["Uyarı: e-posta günlük limiti doldu (2/2)"]);
    expect(emit("2026-10-13", true)).toEqual([]);
    expect(emit("2026-10-14", false, "whatsapp")).toEqual([]);
  });

  it("the follow-up sequence: an unanswered message gets a follow-up draft after the set days, once per step, and an answer stops it", () => {
    const h = openDb(":memory:");
    const claude = appFor(h, "claude", clock);
    const owner = appFor(h, "owner", clock);
    const ada = person(h);
    touch(h, { person_id: ada, at: at("2026-10-11") });
    touch(h, { contact: "x@y.example", at: at("2026-10-13") });
    expect(claude.drafts.followups.due()).toMatchObject([{ person_id: ada, name: "Ada", step: 1, steps: 2, days: 3, channel: "email" }]);
    const made = claude.drafts.followups.generate();
    expect(made.effects).toEqual(["Ada: 1. takip taslağı"]);
    expect(h.sqlite.prepare("SELECT status, followup_step, created_by, reason, body FROM drafts").all()).toEqual([
      { status: "bekliyor", followup_step: 1, created_by: "claude", reason: "Otomatik takip 1/2: 3 gündür cevap yok (e-posta)", body: "Merhaba Ada, geçen gün yazdığım mesajı görme fırsatın oldu mu? Uygun olduğunda kısaca konuşabilirsek sevinirim." },
    ]);
    expect(claude.drafts.followups.generate().created).toEqual([]);
    // a rejected follow-up is not made again for the same step
    owner.drafts.reject(made.created[0].draft_id, "gerek yok");
    expect(claude.drafts.followups.due()).toEqual([]);
    // the days come from the settings; an answer resets the sequence
    owner.settings.setMany({ followup_days: "1,2" });
    touch(h, { person_id: ada, direction: "gelen", at: at("2026-10-12") });
    touch(h, { contact: "q@y.example", at: at("2026-10-12") });
    expect(claude.drafts.followups.due().map((f) => f.contact ?? f.name)).toEqual(["q@y.example", "x@y.example"]);
    expect(claude.drafts.followups.due().map((f) => f.person_id)).not.toContain(ada);
  });

  it("a follow-up draft uses the template the templates module suggests", () => {
    const h = openDb(":memory:");
    h.sqlite.prepare("INSERT INTO templates (name, kind, body, created_at, updated_at, created_by) VALUES ('T', 'takip', 'Selam {ad}', ?, ?, 'owner')").run(at("2026-10-01"), at("2026-10-01"));
    const templates = defineModule({ key: "templates", label: "T", api: () => ({ ref: (id: number) => ({ id, body: "x" }), suggest: () => [{ id: 1, body: "Selam {ad}, bakar mısın?" }] }) });
    const app = appFor(h, "claude", clock, [templates]);
    const ada = person(h);
    touch(h, { person_id: ada, at: at("2026-10-09") });
    app.drafts.followups.generate();
    expect(h.sqlite.prepare("SELECT template_id, body FROM drafts").all()).toEqual([{ template_id: 1, body: "Selam Ada, bakar mısın?" }]);
  });

  it("follow-up dates of people come with whether an outgoing touch followed; created and loose drafts answer the calendar and network", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "claude", clock);
    const ada = person(h, "Ada", { next_follow_up_at: "2026-10-15" });
    const bob = person(h, "Bob", { next_follow_up_at: "2026-10-16" });
    touch(h, { person_id: bob, at: at("2026-10-16") });
    expect(app.drafts.followUpDates("2026-10-14", "2026-10-20")).toEqual([
      { type: "person", id: ada, name: "Ada", date: "2026-10-15", done: false },
      { type: "person", id: bob, name: "Bob", date: "2026-10-16", done: true },
    ]);
    app.drafts.create({ contact: "ada@x.example", channel: "email", body: "x" });
    expect(app.drafts.createdSince("2026-10-14")).toHaveLength(1);
    app.drafts.adoptLoose({ person_id: ada }, ["email:ada@x.example"]);
    expect(h.sqlite.prepare("SELECT person_id, contact FROM drafts").all()).toEqual([{ person_id: ada, contact: "ada@x.example" }]);
  });

  it("a record going to the trash takes or frees its drafts after the other modules cleaned theirs (hook order), and the Today view carries drafts, follow-ups and quota", () => {
    const h = openDb(":memory:");
    // a stand-in whose key sorts after "drafts" still runs first: the draft rows are there while it runs
    let draftsSeen = -1;
    const probe = defineModule({ key: "zz", label: "Z", hooks: { "record.trashed": (ctx) => { draftsSeen = (ctx.sqlite.prepare("SELECT COUNT(*) n FROM drafts").get() as any).n; } } });
    const app = appFor(h, "owner", clock, [probe]);
    const ada = person(h);
    const d = app.drafts.create({ person_id: ada, channel: "email", body: "x" }).row;
    app.save("comment", { target_type: "draft", target_id: d.id, body: "yorum" });
    expect(app.find("comment").rows[0]).toMatchObject({ target_type: "draft", target_label: `taslak #${d.id} (Ada)` });
    expect(app.commentTargets()).toContain("draft");
    expect(app.ctx.types.chatCard("draft")!(app.ctx, d.id)).toMatchObject({ title: "Ada", channel: "email", status: "bekliyor", body: "x" });
    const t = app.today(5);
    expect(t.drafts).toMatchObject({ total: 1 });
    expect(t).toHaveProperty("followups");
    expect(t.quota.date).toBe("2026-10-14");
    expect(app.moduleMeta()).toMatchObject({ draft_statuses: ["bekliyor", "onaylandi", "gonderildi", "reddedildi"], marketing_defaults: { weekly_target: 0 } });

    const bin = new Bin(app.ctx);
    app.ctx.db.transaction((tx) => {
      app.ctx.emit("record.trashed", { type: "person", id: ada, bin } as RecordTrashed);
      bin.commit(tx, "person", ada, "Ada");
    });
    expect(draftsSeen).toBe(1);
    expect(h.sqlite.prepare("SELECT COUNT(*) n FROM drafts").get()).toEqual({ n: 0 });
    expect(h.sqlite.prepare("SELECT COUNT(*) n FROM comments").get()).toEqual({ n: 0 });
    expect(JSON.parse((h.sqlite.prepare("SELECT payload FROM trash").get() as any).payload).parts.map((p: any) => p.table)).toEqual(["comments", "drafts"]);
  });
});
