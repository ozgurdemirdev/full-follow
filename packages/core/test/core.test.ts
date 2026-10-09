import { beforeEach, describe, expect, it } from "vitest";
import { createCore, FFError, openDb, type Clock } from "../src";

/** Her test kendi bellek içi veritabanını kurar; saat sabit */
function setup(today = "2026-10-09") {
  const handle = openDb(":memory:");
  const clock: Clock = { today: () => today, now: () => `${today}T10:00:00Z` };
  const ozgur = createCore(handle, "ozgur", clock);
  const claude = createCore(handle, "claude", clock);
  const source = ozgur.sources.create({ name: "R10", kind: "forum" }).row;
  const person = ozgur.people.create({ name: "Ahmet Yılmaz" }).row;
  const opp = (title = "Ahmet e-ticaret", value: number | null = 50000, p = person.id, s = source.id) =>
    ozgur.opportunities.create({ title, person_id: p, source_id: s, estimated_value: value }).row;
  const sql = <T = any>(q: string, ...a: unknown[]) => handle.sqlite.prepare(q).all(...a) as T[];
  return { handle, ozgur, claude, source, person, opp, sql };
}

const stageOf = (sql: ReturnType<typeof setup>["sql"], id: number) => sql("SELECT stage FROM opportunities WHERE id = ?", id)[0].stage;

describe("çekirdek kurallar", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => { t = setup(); });

  it("1. kazanılan fırsat projeye döner (tek proje, peşinat, ödeme planı, müşteri etiketi)", () => {
    const o = t.opp();
    const r = t.ozgur.opportunities.move(o.id, { stage: "kazanildi" });
    expect(r.effects.join(" ")).toContain("proje");

    let projects = t.sql("SELECT * FROM projects");
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ stage: "pesinat", price: 50000, opportunity_id: o.id });

    const pays = t.sql("SELECT milestone, expected_amount FROM payments ORDER BY id");
    expect(pays).toEqual([
      { milestone: "pesinat", expected_amount: 20000 },
      { milestone: "tasarim_onayi", expected_amount: 15000 },
      { milestone: "yayin", expected_amount: 15000 },
    ]);
    expect(t.sql("SELECT tag FROM person_tags WHERE person_id = ?", t.person.id)).toEqual([{ tag: "musteri" }]);

    // geri çekip tekrar kazanıldıya al: ikinci proje açılmaz
    t.ozgur.opportunities.move(o.id, { stage: "teklif" });
    t.ozgur.opportunities.move(o.id, { stage: "kazanildi" });
    projects = t.sql("SELECT * FROM projects");
    expect(projects).toHaveLength(1);
    expect(t.sql("SELECT COUNT(*) n FROM payments")[0].n).toBe(3);
  });

  it("2. kaybedildi için neden zorunlu", () => {
    const o = t.opp();
    expect(() => t.ozgur.opportunities.move(o.id, { stage: "kaybedildi" })).toThrow(/neden/i);
    expect(stageOf(t.sql, o.id)).toBe("bulundu");

    t.ozgur.opportunities.move(o.id, { stage: "kaybedildi", reason: "bütçe yok" });
    const r = t.sql("SELECT stage, lost_reason, closed_at FROM opportunities WHERE id = ?", o.id)[0];
    expect(r.stage).toBe("kaybedildi");
    expect(r.lost_reason).toBe("bütçe yok");
    expect(r.closed_at).toBeTruthy();
  });

  it("3. gönderilen taslak temas olur ve fırsatı temas aşamasına geçirir", () => {
    const o = t.opp();
    const d = t.claude.drafts.create({ person_id: t.person.id, opportunity_id: o.id, channel: "whatsapp", body: "Merhaba Ahmet Bey" }).row;
    expect(d.status).toBe("bekliyor");
    // Claude onaylayamaz / gönderildi işaretleyemez
    expect(() => t.claude.drafts.markSent(d.id)).toThrow(FFError);
    expect(() => t.claude.drafts.approve(d.id)).toThrow(FFError);
    expect(() => t.claude.drafts.reject(d.id, "x")).toThrow(FFError);
    // MCP'nin genel save yolu da durumu değiştiremez
    t.claude.save("draft", { status: "gonderildi" }, d.id);
    expect(t.sql("SELECT status FROM drafts WHERE id = ?", d.id)[0].status).toBe("bekliyor");
    expect(t.sql("SELECT COUNT(*) n FROM touches")[0].n).toBe(0);

    t.ozgur.drafts.markSent(d.id);
    expect(t.sql("SELECT status FROM drafts WHERE id = ?", d.id)[0].status).toBe("gonderildi");
    const touches = t.sql("SELECT * FROM touches");
    expect(touches).toHaveLength(1);
    expect(touches[0]).toMatchObject({ draft_id: d.id, direction: "giden", created_by: "ozgur", person_id: t.person.id, opportunity_id: o.id });
    expect(stageOf(t.sql, o.id)).toBe("temas");
    expect(() => t.ozgur.drafts.markSent(d.id)).toThrow(); // ikinci kez olmaz
  });

  it("4. temas otomatik ilerletme sınırları", () => {
    const a = t.opp("A");
    t.ozgur.touches.create({ person_id: t.person.id, opportunity_id: a.id, channel: "email", direction: "giden", summary: "ilk mesaj" });
    expect(stageOf(t.sql, a.id)).toBe("temas");
    t.ozgur.touches.create({ person_id: t.person.id, opportunity_id: a.id, channel: "email", direction: "gelen", summary: "cevap geldi" });
    expect(stageOf(t.sql, a.id)).toBe("cevap");
    // cevap aşamasındayken gelen/giden temas aşamayı değiştirmez
    t.ozgur.touches.create({ person_id: t.person.id, opportunity_id: a.id, channel: "email", direction: "gelen", summary: "bir daha" });
    expect(stageOf(t.sql, a.id)).toBe("cevap");

    // teklif aşamasındaki fırsata temas aşamayı değiştirmez; bulundu + gelen de değiştirmez
    const b = t.opp("B");
    t.ozgur.opportunities.move(b.id, { stage: "teklif" });
    t.ozgur.touches.create({ person_id: t.person.id, opportunity_id: b.id, channel: "telefon", direction: "giden", summary: "arama" });
    expect(stageOf(t.sql, b.id)).toBe("teklif");
    const c = t.opp("C");
    t.ozgur.touches.create({ person_id: t.person.id, opportunity_id: c.id, channel: "email", direction: "gelen", summary: "kendisi yazdı" });
    expect(stageOf(t.sql, c.id)).toBe("bulundu");
  });

  it("5. kim yaptı giriş noktasından gelir, girdiden değil", () => {
    const p = t.claude.people.create({ name: "Zeynep", created_by: "ozgur" } as any).row;
    expect(p.created_by).toBe("claude");
    const o = t.claude.opportunities.create({ title: "Z", person_id: p.id, source_id: t.source.id, created_by: "ozgur" } as any).row;
    expect(o.created_by).toBe("claude");
    t.claude.opportunities.move(o.id, { stage: "teklif" });
    const ev = t.sql("SELECT created_by FROM events WHERE type = 'opp.stage'");
    expect(ev).toEqual([{ created_by: "claude" }]);
    const own = t.ozgur.people.create({ name: "Mert", created_by: "claude" } as any).row;
    expect(own.created_by).toBe("ozgur");

    // MCP'nin kullandığı genel save yolu (isimle referans) da girdideki created_by'ı yok sayar
    const touch = t.claude.save("touch", { person: "Zeynep", channel: "email", direction: "giden", summary: "selam", created_by: "ozgur" }).row;
    const c = t.claude.save("comment", { target_type: "person", target_id: p.id, body: "not", created_by: "ozgur" }).row;
    expect([touch.created_by, c.created_by]).toEqual(["claude", "claude"]);
    expect(t.sql("SELECT DISTINCT created_by FROM events WHERE type IN ('touch.created','comment.created')")).toEqual([{ created_by: "claude" }]);
  });

  it("6. fiyat tabanı ve aylık rapor (kısmi ödeme ödendiği aya yazılır)", () => {
    t.ozgur.settings.setMany({ bagkur_monthly: 5000, accounting_monthly: 1000, other_fixed_monthly: 2000, target_net_monthly: 22000 });
    expect(t.ozgur.settings.priceFloor().floor).toBe(30000);
    t.ozgur.settings.set("tax_rate_percent", 25);
    expect(t.ozgur.settings.priceFloor().floor).toBe(40000); // 30000 / 0.75

    const proj = t.ozgur.projects.create({ name: "P", person_id: t.person.id, price: 100000 }).row;
    const pays = t.sql("SELECT id, milestone FROM payments WHERE project_id = ? ORDER BY id", proj.id);
    t.ozgur.payments.pay(pays[0].id, 40000, "2026-10-05");
    t.ozgur.payments.pay(pays[1].id, 10000, "2026-10-20"); // kısmi, ekim
    t.ozgur.payments.pay(pays[1].id, 15000, "2026-11-03"); // aynı taksitin kalanı, kasım
    t.ozgur.payments.pay(pays[2].id, 5000, "2026-11-02");

    const oct = t.ozgur.reports.month("2026-10");
    expect(oct).toMatchObject({ collected: 50000, floor: 40000, gap: 10000 });
    expect(t.ozgur.reports.month("2026-11")).toMatchObject({ collected: 20000, gap: -20000 });
    expect(() => t.ozgur.payments.pay(pays[2].id, 99999)).toThrow(/Kalan/);

    // düzeltme: yanlış girilen ödeme elle düzeltilince rapor da düzelir (ekim 10.000 → 0, kasım 15.000 → 20.000)
    t.ozgur.payments.update(pays[1].id, { paid_amount: 20000, paid_at: "2026-11-10" });
    expect(t.ozgur.reports.month("2026-10").collected).toBe(40000);
    expect(t.ozgur.reports.month("2026-11").collected).toBe(25000);
  });

  it("7. kaynak dönüşüm oranı: kazanılan / kapanan, açıklar paydaya girmez", () => {
    const r10 = t.source;
    const list = t.ozgur.sources.create({ name: "Ajans listesi", kind: "liste" }).row;
    const mk = (title: string, s: number) => t.opp(title, 1000, t.person.id, s);
    const [a, b, c] = [mk("a", r10.id), mk("b", r10.id), mk("c", r10.id)];
    mk("açık", r10.id);
    t.ozgur.opportunities.move(a.id, { stage: "kazanildi" });
    t.ozgur.opportunities.move(b.id, { stage: "kaybedildi", reason: "x" });
    t.ozgur.opportunities.move(c.id, { stage: "kaybedildi", reason: "y" });
    const z = mk("z", list.id);
    t.ozgur.opportunities.move(z.id, { stage: "kazanildi" });

    const rows = t.ozgur.reports.bySource();
    const r = rows.find((x) => x.source === "R10")!;
    expect(r).toMatchObject({ total: 4, won: 1, lost: 2, open: 1 });
    expect(r.conversion).toBeCloseTo(1 / 3);
    expect(rows.find((x) => x.source === "Ajans listesi")!.conversion).toBe(1);
  });

  it("8. peşinat bloğu: ödenmeden proje ilerlemez, ödenince ilerler", () => {
    const o = t.opp();
    t.ozgur.opportunities.move(o.id, { stage: "kazanildi" });
    const proj = t.sql("SELECT id FROM projects")[0];
    expect(() => t.ozgur.projects.move(proj.id, { stage: "tasarim_onayi" })).toThrow(/Peşinat/);
    const dep = t.sql("SELECT id, expected_amount FROM payments WHERE milestone = 'pesinat'")[0];
    t.ozgur.payments.pay(dep.id, dep.expected_amount - 1);
    expect(() => t.ozgur.projects.move(proj.id, { stage: "tasarim_onayi" })).toThrow(/Peşinat/);
    t.ozgur.payments.pay(dep.id, 1);
    t.ozgur.projects.move(proj.id, { stage: "tasarim_onayi" });
    expect(t.sql("SELECT stage FROM projects WHERE id = ?", proj.id)[0].stage).toBe("tasarim_onayi");
    // geri almak ve iptal serbest
    t.ozgur.projects.move(proj.id, { stage: "pesinat" });
    t.ozgur.projects.move(proj.id, { stage: "iptal" });

    // fiyatsız proje: peşinat planı yok, yine ilerleyemez; Claude da aynı kurala tabi
    const bare = t.ozgur.projects.create({ name: "Fiyatsız", person_id: t.person.id }).row;
    expect(() => t.claude.move("project", bare.id, "tasarim_onayi")).toThrow(/Peşinat/);
    expect(() => t.claude.save("project", { stage: "yayin" }, bare.id)).toThrow(/move/);
  });

  it("9. yorumlar: cevapsız konu Claude'a görünür, cevap yazınca düşer", () => {
    const first = t.ozgur.comments.add({ target_type: "person", target_id: t.person.id, body: "Bu kişiyi ajans olarak etiketle mi?" }).row;
    expect(first.created_by).toBe("ozgur");
    expect(t.claude.find("comment", { filter: { unanswered: true } }).rows.map((x) => x.id)).toEqual([first.id]);

    const reply = t.claude.comments.add({ reply_to: first.id, body: "Etiketledim." }).row;
    expect(reply).toMatchObject({ created_by: "claude", parent_id: first.id, target_type: "person" });
    expect(t.claude.find("comment", { filter: { unanswered: true } }).total).toBe(0);

    // Özgür tekrar yazınca konu yine cevapsız; kapatılınca listeden düşer
    t.ozgur.comments.add({ reply_to: reply.id, body: "Teşekkürler, bir de e-posta ekle" });
    expect(t.claude.find("comment", { filter: { unanswered: true } }).total).toBe(1);
    t.claude.comments.resolve(first.id);
    expect(t.claude.find("comment", { filter: { unanswered: true } }).total).toBe(0);
    expect(() => t.claude.comments.update(first.id, { body: "başkasının yorumu" })).toThrow(FFError);

    // kapalı konuya Özgür yazınca konu açılır ve yine cevapsız olur
    const again = t.ozgur.comments.add({ reply_to: first.id, body: "Unuttum, telefonu da ekle" });
    expect(again.effects).toContain("konu yeniden açıldı");
    expect(t.claude.find("comment", { filter: { unanswered: true } }).total).toBe(1);
    // Claude, Özgür'ün yorumunu silerek listeden düşüremez
    expect(() => t.claude.remove("comment", again.row.id)).toThrow(FFError);
    expect(() => t.claude.remove("comment", first.id)).toThrow(FFError);
    expect(t.claude.find("comment", { filter: { unanswered: true } }).total).toBe(1);
  });
});
