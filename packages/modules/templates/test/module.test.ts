import { describe, expect, it } from "vitest";
import { defineModule, openDb, type Clock } from "@fullfollow/core";
import { appFor, person, sentDraft } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };

describe("templates as a module", () => {
  it("templates go through the generic save, find, get and delete by their Turkish alias; the sector is given by path and the template by name", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "claude", clock);
    const t = app.save("şablon", { name: "İlk e-posta", kind: "ilk", channel: "email", sector: "Sağlık > Diş hekimi", body: "Merhaba {ad}" }).row;
    expect(t).toMatchObject({ name: "İlk e-posta", kind: "ilk", channel: "email", created_by: "claude" });
    expect(app.get("template", "İlk e-posta").row).toMatchObject({ id: t.id, sector_path: "Sağlık > Diş hekimi", used: 0, sent: 0, replied: 0, reply_rate: null, early: true });
    expect(app.find("sablon", { filter: { channel: "email" } }).total).toBe(1);
    expect(app.find("template", { filter: { channel: "instagram" } }).total).toBe(0);
    expect(app.find("template", { filter: { sector: "Sağlık" } }).total).toBe(1);
    expect(app.find("template", { filter: { kind: "takip" } }).total).toBe(0);
    expect(app.find("template", { q: "diş" }).total).toBe(1);
    app.save("template", { channel: null, body: "Selam {ad}" }, t.id);
    expect(app.get("template", t.id).row).toMatchObject({ channel: null, body: "Selam {ad}" });
    expect(() => app.save("template", { name: "", body: "x" })).toThrow(/name/);
    expect(() => app.save("template", { name: "X", kind: "yok", body: "x" })).toThrow(/kind/);
    expect(() => app.save("template", { name: "X", body: "x", sector_id: 999 })).toThrow(/sektör #999 bulunamadı/);
    expect(app.remove("template", t.id).trash).toEqual({ type: "template", id: t.id });
    expect(app.find("trash").rows[0]).toMatchObject({ type: "template", what: "şablon" });
    app.restore("template", "İlk e-posta");
    expect(app.get("template", t.id).row.name).toBe("İlk e-posta");
    expect(app.moduleMeta()).toMatchObject({ template_kinds: ["ilk", "takip", "teklif", "diger"] });
  });

  it("deleting a template keeps its drafts and only empties their template link; restoring ties them back", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const t = app.templates.create({ name: "T", body: "x" }).row;
    sentDraft(h, t.id, "a@x.example", false);
    expect(app.templates.get(t.id)).toMatchObject({ used: 1, sent: 1 });
    app.remove("template", t.id);
    expect(h.sqlite.prepare("SELECT template_id FROM drafts").all()).toEqual([{ template_id: null }]);
    app.restore("template", t.id);
    expect(h.sqlite.prepare("SELECT template_id FROM drafts").all()).toEqual([{ template_id: t.id }]);
  });

  it("render fills {ad}, {ad_soyad}, {firma} and {sektor} for the recipient and leaves unknown placeholders alone", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const t = app.templates.create({ name: "T", sector: "Sağlık > Diş hekimi", body: "Merhaba {ad} ({ad_soyad}), {firma} için {sektor} {bilinmeyen}" }).row;
    const sector = (h.sqlite.prepare("SELECT id FROM sectors WHERE name = 'Diş hekimi'").get() as any).id;
    const ada = person(h, "Dr. Ada Lovelace", { company: "Gülüş Diş", sector });
    expect(app.templates.render(t.id, { person_id: ada }).body).toBe("Merhaba Ada (Dr. Ada Lovelace), Gülüş Diş için Diş hekimi {bilinmeyen}");
    expect(app.templates.render(t.id, { contact: "info@x.example" }).body).toBe("Merhaba (info@x.example), için {bilinmeyen}");
    expect(() => app.templates.render(t.id, {})).toThrow(/kişi ya da firma gerekli/);
    expect(() => app.templates.render(999, { person_id: ada })).toThrow(/şablon #999 bulunamadı/);
  });

  it("suggest ranks the templates that fit the recipient and channel: same channel over all channels, the recipient's sector over none, others are left out", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const mk = (b: Record<string, unknown>) => app.templates.create({ body: "x", ...b }).row;
    const general = mk({ name: "Genel" });
    const email = mk({ name: "E-posta", channel: "email" });
    const health = mk({ name: "Sağlık e-posta", channel: "email", sector: "Sağlık > Diş hekimi" });
    const other = mk({ name: "Eğitim", sector: "Eğitim" });
    const dm = mk({ name: "DM", channel: "instagram" });
    const follow = mk({ name: "Takip", kind: "takip", channel: "email" });
    const sector = (h.sqlite.prepare("SELECT id FROM sectors WHERE name = 'Diş hekimi'").get() as any).id;
    const ada = person(h, "Ada", { sector });
    expect(app.templates.suggest({ person_id: ada }, "email").map((s) => s.name)).toEqual(["Sağlık e-posta", "E-posta", "Takip", "Genel"]);
    expect(app.templates.suggest({ person_id: ada }, "instagram").map((s) => s.name)).toEqual(["DM", "Genel"]);
    expect(app.templates.suggest({ person_id: ada }, "email", "takip").map((s) => s.id)).toEqual([follow.id]);
    expect(app.templates.suggest({ contact: "x@y.example" }, "email").map((s) => s.id)).toEqual([email.id, follow.id, general.id]);
    expect(app.templates.suggest({ person_id: ada }, "email").map((s) => s.id)).not.toContain(other.id);
    expect(app.templates.suggest({ person_id: ada }, "instagram")[0].id).toBe(dm.id);
    expect(health.sector_id).toBe(sector);
    expect(() => app.templates.suggest({})).toThrow(/kişi ya da firma gerekli/);
  });

  it("statistics count the drafts made from a template, the sent ones and the answered ones; a rate over few messages is early", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const a = app.templates.create({ name: "A", channel: "email", body: "x" }).row;
    const b = app.templates.create({ name: "B", channel: "email", body: "y" }).row;
    for (let i = 0; i < 22; i++) sentDraft(h, a.id, `a${i}@x.example`, i < 10);
    for (let i = 0; i < 21; i++) sentDraft(h, b.id, `b${i}@x.example`, i < 2);
    h.sqlite.prepare("INSERT INTO drafts (contact, channel, body, status, template_id, created_at, updated_at, created_by) VALUES ('w@x.example', 'email', 'x', 'bekliyor', ?, ?, ?, 'claude')").run(a.id, "2026-10-14T10:00:00Z", "2026-10-14T10:00:00Z");
    expect(app.templates.get(a.id)).toMatchObject({ used: 23, sent: 22, replied: 10, early: false });
    expect(app.templates.get(a.id)!.reply_rate).toBeCloseTo(10 / 22);
    expect(app.templates.get(b.id)).toMatchObject({ used: 21, sent: 21, replied: 2, early: false });
    const [group] = app.templates.comparison();
    expect(group).toMatchObject({ kind: "ilk", channel: "email" });
    expect(group.templates.map((t) => [t.name, t.leader])).toEqual([["A", true], ["B", false]]);
    // sent messages to bare addresses have no sector
    expect(group.templates[0].sectors).toEqual([{ sector_path: "Sektörsüz", sent: 22, replied: 10, reply_rate: 10 / 22, early: false }]);
    // with one template short of the sample size there is no leader
    const c = app.templates.create({ name: "C", channel: "email", body: "z" }).row;
    sentDraft(h, c.id, "c@x.example", true);
    const ranked = app.templates.comparison()[0].templates;
    expect(ranked.map((t) => t.name)).toEqual(["A", "B", "C"]);
    expect(ranked.find((t) => t.name === "C")).toMatchObject({ early: true, sent: 1 });
    // the tip: the leader says so, a poor template with enough sends is flagged and names the better one, a small sample is not trusted, no sends yet means no measurement
    const d = app.templates.create({ name: "D", channel: "email", body: "w" }).row;
    expect(app.templates.get(a.id)).toMatchObject({ retire: false, tip: "Aynı tür ve kanalda en yüksek cevap oranı bu şablonda (%45)." });
    expect(app.templates.get(b.id)).toMatchObject({ retire: true, tip: "Bu şablon 21 kez gitti, 2 cevap aldı. Aynı tür ve kanalda “A” %45 cevap alıyor. Bunu arşive kaldırmanı öneririm." });
    expect(app.templates.get(c.id)).toMatchObject({ retire: false, tip: "Gönderimi az olduğu için oranı henüz güvenilir değil." });
    expect(app.templates.get(d.id)).toMatchObject({ retire: false, tip: "Henüz ölçüm yok. Bir taslakta kullanıp gönderince cevap oranı burada görünür." });
    // alone in its group a poor template has no better one to point at; a template in another channel is not compared with them
    const dm = app.templates.create({ name: "DM", channel: "instagram", body: "v" }).row;
    for (let i = 0; i < 20; i++) sentDraft(h, dm.id, `dm${i}@x.example`, false);
    expect(app.templates.get(dm.id)).toMatchObject({ retire: true, tip: "Bu şablon 20 kez gitti, 0 cevap aldı. Bunu arşive kaldırmanı öneririm." });
  });

  it("the panel chat chip shows the stored text and, for a person, the text filled for them", () => {
    const h = openDb(":memory:");
    const people = defineModule({ key: "people", label: "P", api: () => ({ get: (id: number) => ({ id, name: "Ada Lovelace" }) }) });
    const app = appFor(h, "ozgur", clock, [people]);
    const t = app.templates.create({ name: "T", body: "Merhaba {ad}" }).row;
    const ada = person(h, "Ada Lovelace");
    const card = app.ctx.types.chatCard("template")!;
    expect(card(app.ctx, t.id)).toMatchObject({ title: "T", body: "Merhaba {ad}", filled: null, for_name: null, used: 0 });
    expect(card(app.ctx, t.id, ada)).toMatchObject({ filled: "Merhaba Ada", for_name: "Ada Lovelace", person_id: ada });
    expect(() => card(app.ctx, 999)).toThrow(/template not found/);
  });
});
