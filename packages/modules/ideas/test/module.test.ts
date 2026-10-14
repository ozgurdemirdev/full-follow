import { describe, expect, it } from "vitest";
import { Bin, FFError, openDb, type Clock, type RecordTrashed, type TouchCreated, type TouchUpdated } from "@fullfollow/core";
import { appFor, fakePeople, fakeProjects, person, project, touch } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };
const events = (h: ReturnType<typeof openDb>) => h.sqlite.prepare("SELECT type FROM events ORDER BY id").all().map((e: any) => e.type);

describe("ideas as a module", () => {
  it("the money note is saved and edited; the verdict reads the share of answers that were interested, with its own sentence per case", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const idea = app.ideas.create({ title: "Klinik botu", money_note: "₺2.500 × 10 klinik" }).row;
    expect(app.get("idea", idea.id).row).toMatchObject({ money_note: "₺2.500 × 10 klinik", told: 0, answered: 0, interest_share: null, rate_tone: null });
    expect(app.get("idea", idea.id).row.verdict).toBe("Karar için az. En az 3 kişiden cevap al; 0 kişi henüz dönmedi.");
    expect(app.ideas.update(idea.id, { money_note: null }).row.money_note).toBeNull();
    // 2 told and not answered, 1 interested: too few answers to say, 3 are pending in the sentence
    const tell = (n: number, interest: string) => { for (let i = 0; i < n; i++) app.ideas.saveInterest({ idea_id: idea.id, person_id: person(h), interest }); };
    tell(2, "anlatildi");
    tell(1, "ilgilendi");
    expect(app.get("idea", idea.id).row).toMatchObject({ told: 3, answered: 1, interest_share: 1, rate_tone: "strong", verdict: "Karar için az. En az 3 kişiden cevap al; 2 kişi henüz dönmedi." });
    // 3 answers, 2 interested = 0.67 strong; the idea is early so the next step is a demo, the unanswered two do not dilute the share
    tell(1, "ilgilendi");
    tell(1, "ilgilenmedi");
    expect(app.get("idea", idea.id).row).toMatchObject({ answered: 3, interest_share: 2 / 3, rate_tone: "strong", verdict: "İlgi güçlü. Demo aşamasına geçip küçük bir örnek göster." });
    app.ideas.move(idea.id, "demo");
    expect(app.get("idea", idea.id).row.verdict).toBe("İlgi güçlü. Projeye dönüştürmek için yeterli sinyal var.");
    // mixed from 0.4, weak below
    tell(1, "ilgilenmedi");
    expect(app.get("idea", idea.id).row).toMatchObject({ answered: 4, interest_share: 0.5, rate_tone: "mixed", verdict: "Karışık. İlgilenmeyenlerin nedenine bak, fiyat mı ihtiyaç mı?" });
    tell(2, "ilgilenmedi");
    expect(app.get("idea", idea.id).row).toMatchObject({ answered: 6, interest_share: 2 / 6, rate_tone: "weak", verdict: "İlgi zayıf. Bırakmayı ya da kime anlattığını değiştirmeyi düşün." });
    // the older rate that counts the unanswered too is still served
    expect(app.get("idea", idea.id).row.interest_rate).toBe(2 / 8);
  });

  it("ideas go through the generic save, find, get, move and delete by their Turkish alias; sectors are given by path and the parent by name", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "claude", clock);
    const top = app.save("fikir", { title: "Klinik botu", problem: "randevu kaçıyor", sectors: ["Sağlık > Diş hekimi"] }).row;
    const sub = app.save("idea", { title: "Hatırlatma", parent: "Klinik botu" }).row;
    expect(sub.parent_id).toBe(top.id);
    expect(app.get("idea", "Klinik botu").row).toMatchObject({ id: top.id, stage: "fikir", created_by: "claude", told: 0, interest_rate: null, child_count: 1, sectors: [{ path: "Sağlık > Diş hekimi" }] });
    expect(app.get("idea", sub.id).row).toMatchObject({ parent_title: "Klinik botu", own_project_id: null });
    expect(app.find("ideas", { filter: { stage: "fikir" } }).total).toBe(2);
    expect(app.find("idea", { filter: { sector: "Sağlık" } }).rows.map((i) => i.id)).toEqual([top.id]);
    expect(app.find("idea", { filter: { general: true } }).total).toBe(2);
    expect(app.find("idea", { q: "randevu" }).total).toBe(1);
    expect(app.move("idea", top.id, "demo").effects).toEqual(["fikir → demo"]);
    expect(() => app.move("idea", top.id, "uçuyor")).toThrow(/fikir aşaması/);
    expect(events(h)).toEqual(["sector.created", "sector.created", "idea.created", "idea.created", "idea.stage"]);
    // deleting the parent keeps the sub idea, which loses its parent; restoring ties it back
    expect(app.remove("idea", top.id).trash).toEqual({ type: "idea", id: top.id });
    expect(app.get("idea", sub.id).row.parent_id).toBeNull();
    expect(h.sqlite.prepare("SELECT COUNT(*) n FROM idea_sectors").get()).toEqual({ n: 0 });
    app.restore("idea", "Klinik botu");
    expect(app.get("idea", sub.id).row.parent_id).toBe(top.id);
    expect(app.get("idea", top.id).row.sectors).toHaveLength(1);
    expect(app.find("trash").total).toBe(0);
    expect(app.moduleMeta()).toMatchObject({ idea_stages: ["fikir", "dogrulaniyor", "demo", "urun"], interest_levels: ["anlatildi", "ilgilendi", "ilgilenmedi"] });
  });

  it("two levels only, and an idea that belongs to a project is checked against the own-projects module", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock, [fakeProjects()]);
    const p = project(h);
    const top = app.ideas.create({ title: "Üst" }).row;
    const sub = app.ideas.create({ title: "Alt", parent_id: top.id }).row;
    expect(() => app.ideas.create({ title: "x", parent_id: sub.id })).toThrow(/zaten bir alt fikir/);
    expect(() => app.ideas.update(top.id, { parent_id: sub.id })).toThrow(FFError);
    expect(() => app.ideas.update(top.id, { parent_id: top.id })).toThrow(/kendi altına konamaz/);
    expect(() => app.ideas.update(sub.id, { parent_id: 999 })).toThrow(/üst fikir #999 bulunamadı/);
    const mine = app.save("idea", { title: "Proje fikri", own_project: "Full Follow", priority: "yuksek" }).row;
    expect(mine).toMatchObject({ own_project_id: p, priority: "yuksek", position: 0 });
    expect(() => app.ideas.create({ title: "y", own_project_id: p, parent_id: top.id })).toThrow(/üst fikrin altına konamaz/);
    expect(() => app.ideas.create({ title: "y", parent_id: mine.id })).toThrow(/proje fikri üst fikir olamaz/);
    expect(() => app.ideas.update(top.id, { own_project_id: p })).toThrow(/alt fikirleri olan fikir projeye taşınamaz/);
    expect(() => app.ideas.create({ title: "z", own_project_id: 999 })).toThrow(/kendi projesi #999 bulunamadı/);
    expect(() => app.ideas.create({ title: "z", priority: "yuksek" })).toThrow(/sadece proje fikirlerinde/);
    expect(() => app.ideas.update(sub.id, { done: true })).toThrow(/sadece proje fikirlerinde/);
    // positions inside a priority group, done ideas leave the group, moving back to the general list clears done
    const a = app.ideas.create({ title: "a", own_project_id: p }).row;
    const b = app.ideas.create({ title: "b", own_project_id: p }).row;
    app.ideas.update(b.id, { position: 0 });
    expect(h.sqlite.prepare("SELECT title, position FROM ideas WHERE own_project_id = ? AND priority = 'orta' ORDER BY position").all(p)).toEqual([{ title: "b", position: 0 }, { title: "a", position: 1 }]);
    app.ideas.update(b.id, { done: true });
    expect(h.sqlite.prepare("SELECT title, position FROM ideas WHERE own_project_id = ? AND priority = 'orta' AND done_at IS NULL").all(p)).toEqual([{ title: "a", position: 0 }]);
    expect(app.ideas.update(b.id, { own_project_id: null }).row).toMatchObject({ own_project_id: null, done_at: null, position: 0 });
    expect(app.ideas.update(a.id, { own_project_id: null }).effects).toEqual(["fikir → Para kazanma fikirleri"]);
    // without the own-projects module a project cannot be given
    const bare = appFor(h, "ozgur", clock);
    expect(() => bare.ideas.create({ title: "q", own_project_id: p })).toThrow(/"own-projects" modülü kurulu değil/);
    // but an idea that already sits in a project can still be renamed
    expect(bare.ideas.update(mine.id, { title: "Yeni ad" }).row.title).toBe("Yeni ad");
  });

  it("interest: a person is linked once per idea, told first, interest and note updated later, removal goes to the trash and comes back", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock, [fakePeople()]);
    const idea = app.ideas.create({ title: "Klinik botu" }).row;
    const ada = person(h);
    const first = app.ideas.saveInterest({ idea_id: idea.id, person_id: ada });
    expect(first.effects).toEqual(["Ada fikre bağlandı"]);
    expect(first.row).toMatchObject({ interest: "anlatildi", touch_id: null });
    const again = app.ideas.saveInterest({ idea_id: idea.id, person_id: ada, interest: "ilgilendi", note: "demo istedi" });
    expect(again.effects).toEqual([]);
    expect(again.row).toMatchObject({ id: first.row.id, interest: "ilgilendi", note: "demo istedi" });
    expect(events(h)).toEqual(["idea.created", "idea.told", "idea.interest"]);
    expect(app.get("idea", idea.id).row).toMatchObject({ told: 1, interested: 1, interest_rate: 1 });
    expect(app.find("interest", { filter: { idea_id: idea.id } }).rows[0]).toMatchObject({ person_name: "Ada", idea_title: "Klinik botu", interest: "ilgilendi" });
    expect(app.find("ilgi", { filter: { person_id: ada, interest: "ilgilenmedi" } }).total).toBe(0);
    expect(app.get("idea", idea.id, ["people"]).related.people.map((r: any) => r.id)).toEqual([first.row.id]);
    expect(app.ideas.people(undefined, ada).map((r) => r.idea_title)).toEqual(["Klinik botu"]);
    app.save("interest", { interest: "ilgilenmedi" }, first.row.id);
    expect(app.get("interest", first.row.id).row).toMatchObject({ interest: "ilgilenmedi", note: "demo istedi" });
    expect(() => app.ideas.saveInterest({ idea_id: idea.id, person_id: 999 })).toThrow(/kişi #999 bulunamadı/);
    // the people are given by name through the generic save
    expect(app.save("interest", { idea: "Klinik botu", person: "Ada" }).row.id).toBe(first.row.id);
    expect(app.remove("interest", first.row.id).trash).toEqual({ type: "interest", id: first.row.id });
    expect(app.find("trash").rows[0]).toMatchObject({ type: "interest", what: "fikir ilgisi" });
    app.restore("interest", first.row.id);
    expect(app.get("idea", idea.id).row.told).toBe(1);
  });

  it("a touch about an idea links its person to it (touch.created and touch.updated), keeping an interest that was set", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const idea = app.ideas.create({ title: "Klinik botu" }).row;
    const ada = person(h);
    const t = touch(h, ada);
    const created = (idea_id: number | undefined, person_id: number | null) => h.sqlite.transaction(() => app.ctx.emit("touch.created", {
      touch: { id: t }, subject: { person_id }, cold: false, input: { channel: "email", direction: "giden", kind: "mesaj", idea_id },
    } as TouchCreated))();
    expect(created(undefined, ada)).toEqual([]);
    expect(created(idea.id, null)).toEqual([]);
    expect(created(idea.id, ada)).toEqual(["Ada fikre bağlandı"]);
    expect(h.sqlite.prepare("SELECT interest, touch_id FROM idea_people").all()).toEqual([{ interest: "anlatildi", touch_id: t }]);
    app.ideas.saveInterest({ idea_id: idea.id, person_id: ada, interest: "ilgilendi" });
    expect(created(idea.id, ada)).toEqual([]);
    expect(h.sqlite.prepare("SELECT interest FROM idea_people").all()).toEqual([{ interest: "ilgilendi" }]);
    const other = app.ideas.create({ title: "İkinci" }).row;
    const updated = (changes: object) => h.sqlite.transaction(() => app.ctx.emit("touch.updated", { touch: { id: t, person_id: ada }, changes } as TouchUpdated))();
    expect(updated({ summary: "x" })).toEqual([]);
    expect(updated({ idea_id: other.id })).toEqual(["Ada fikre bağlandı"]);
    expect(h.sqlite.prepare("SELECT COUNT(*) n FROM idea_people").get()).toEqual({ n: 2 });
  });

  it("a person, touch or own project that goes to the trash takes or frees what points at it", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const p = project(h);
    const idea = app.ideas.create({ title: "Fikir" }).row;
    h.sqlite.prepare("UPDATE ideas SET own_project_id = ? WHERE id = ?").run(p, idea.id);
    const ada = person(h);
    const t = touch(h, ada);
    app.ideas.saveInterest({ idea_id: idea.id, person_id: ada, touch_id: t });
    const trash = (type: string, id: number) => {
      const bin = new Bin(app.ctx);
      app.ctx.db.transaction((tx) => {
        app.ctx.emit("record.trashed", { type, id, bin } as RecordTrashed);
        bin.commit(tx, type, id, "x");
      });
      return JSON.parse((h.sqlite.prepare("SELECT payload FROM trash ORDER BY id DESC LIMIT 1").get() as any).payload);
    };
    expect(trash("touch", t)).toEqual({ parts: [], links: [{ table: "idea_people", col: "touch_id", value: t, ids: [1] }] });
    expect(h.sqlite.prepare("SELECT touch_id FROM idea_people").all()).toEqual([{ touch_id: null }]);
    expect(trash("own_project", p).links).toEqual([{ table: "ideas", col: "own_project_id", value: p, ids: [idea.id] }]);
    expect(h.sqlite.prepare("SELECT own_project_id FROM ideas").all()).toEqual([{ own_project_id: null }]);
    expect(trash("person", ada).parts.map((x: any) => x.table)).toEqual(["idea_people"]);
    expect(h.sqlite.prepare("SELECT COUNT(*) n FROM idea_people").get()).toEqual({ n: 0 });
  });

  it("an own project takes an idea over: the sub ideas move into it, the idea goes to the trash", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const top = app.ideas.create({ title: "Üst", sectors: ["Yazılım"] }).row;
    const a = app.ideas.create({ title: "A", parent_id: top.id }).row;
    const b = app.ideas.create({ title: "B", parent_id: top.id }).row;
    const p = project(h);
    expect(app.ideas.sectorIds(top.id)).toHaveLength(1);
    expect(h.sqlite.transaction(() => app.ctx.db.transaction((tx) => app.ideas.handOver(tx, top.id, p)))()).toBe(2);
    expect(h.sqlite.prepare("SELECT id, parent_id, own_project_id, priority, position FROM ideas ORDER BY id").all()).toEqual([
      { id: a.id, parent_id: null, own_project_id: p, priority: "orta", position: 0 },
      { id: b.id, parent_id: null, own_project_id: p, priority: "orta", position: 1 },
    ]);
    expect(h.sqlite.prepare("SELECT type, record_id FROM trash").all()).toEqual([{ type: "idea", record_id: top.id }]);
    expect(events(h).slice(-1)).toEqual(["idea.deleted"]);
  });

  it("comments hang on ideas, the panel chat shows a chip, and the project's ideas list with their priority order", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock, [fakeProjects()]);
    const p = project(h);
    const idea = app.ideas.create({ title: "Klinik botu", stage: "demo" }).row;
    app.save("comment", { target_type: "idea", target_id: idea.id, body: "güzel" });
    expect(app.find("comment").rows[0]).toMatchObject({ target_type: "idea", target_label: "Klinik botu" });
    expect(app.commentTargets()).toContain("idea");
    expect(app.ctx.types.chatCard("idea")!(app.ctx, idea.id)).toEqual({ title: "Klinik botu", stage: "demo" });
    expect(() => app.ctx.types.chatCard("idea")!(app.ctx, 999)).toThrow(/idea not found/);
    const low = app.ideas.create({ title: "düşük", own_project_id: p, priority: "dusuk" }).row;
    const high = app.ideas.create({ title: "yüksek", own_project_id: p, priority: "yuksek" }).row;
    const done = app.ideas.create({ title: "yapıldı", own_project_id: p, priority: "yuksek" }).row;
    app.ideas.update(done.id, { done: true });
    expect(app.get("own_project", p, ["ideas"]).related.ideas.map((i: any) => i.id)).toEqual([high.id, low.id, done.id]);
    expect(app.get("idea", high.id).row).toMatchObject({ own_project_title: "Full Follow", priority: "yuksek" });
  });
});
