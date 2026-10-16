import { beforeEach, describe, expect, it } from "vitest";
import { FFError, openDb, type Clock } from "@fullfollow/core";
import { appFor, suite } from "./helpers";

/** Her test kendi bellek içi veritabanını kurar; saat sabit */
function setup(today = "2026-10-09") {
  const handle = openDb(":memory:");
  const clock: Clock = { today: () => today, now: () => `${today}T10:00:00Z` };
  const owner = appFor(handle, "owner", clock);
  const claude = appFor(handle, "claude", clock);
  // "R10" kaynağı migration'la gelir (nereden buldum listesi)
  const source = owner.get("source", "R10").row;
  const person = owner.people.create({ name: "Ahmet Yılmaz" }).row;
  const opp = (title = "Ahmet e-ticaret", value: number | null = 50000, p = person.id, s = source.id) =>
    owner.opportunities.create({ title, person_id: p, source_id: s, estimated_value: value }).row;
  const sql = <T = any>(q: string, ...a: unknown[]) => handle.sqlite.prepare(q).all(...a) as T[];
  return { handle, owner, claude, source, person, opp, sql };
}

const stageOf = (sql: ReturnType<typeof setup>["sql"], id: number) => sql("SELECT stage FROM opportunities WHERE id = ?", id)[0].stage;

suite("çekirdek kurallar", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => { t = setup(); });

  it("1. kazanılan fırsat projeye döner (tek proje, peşinat, ödeme planı, müşteri etiketi)", () => {
    const o = t.opp();
    const r = t.owner.opportunities.move(o.id, { stage: "kazanildi" });
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
    expect(t.sql("SELECT g.slug FROM person_tags x JOIN tags g ON g.id = x.tag_id WHERE x.person_id = ?", t.person.id)).toEqual([{ slug: "musteri" }]);

    // geri çekip tekrar kazanıldıya al: ikinci proje açılmaz
    t.owner.opportunities.move(o.id, { stage: "teklif" });
    t.owner.opportunities.move(o.id, { stage: "kazanildi" });
    projects = t.sql("SELECT * FROM projects");
    expect(projects).toHaveLength(1);
    expect(t.sql("SELECT COUNT(*) n FROM payments")[0].n).toBe(3);
  });

  it("2. kaybedildi için neden zorunlu", () => {
    const o = t.opp();
    expect(() => t.owner.opportunities.move(o.id, { stage: "kaybedildi" })).toThrow(/neden/i);
    expect(stageOf(t.sql, o.id)).toBe("bulundu");

    t.owner.opportunities.move(o.id, { stage: "kaybedildi", reason: "bütçe yok" });
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
    expect(() => t.claude.save("draft", { status: "gonderildi" }, d.id)).toThrow(FFError);
    expect(t.sql("SELECT status FROM drafts WHERE id = ?", d.id)[0].status).toBe("bekliyor");
    expect(t.sql("SELECT COUNT(*) n FROM touches")[0].n).toBe(0);

    t.owner.drafts.markSent(d.id);
    expect(t.sql("SELECT status FROM drafts WHERE id = ?", d.id)[0].status).toBe("gonderildi");
    const touches = t.sql("SELECT * FROM touches");
    expect(touches).toHaveLength(1);
    expect(touches[0]).toMatchObject({ draft_id: d.id, direction: "giden", created_by: "owner", person_id: t.person.id, opportunity_id: o.id });
    expect(stageOf(t.sql, o.id)).toBe("temas");
    expect(() => t.owner.drafts.markSent(d.id)).toThrow(); // ikinci kez olmaz
  });

  it("4. temas otomatik ilerletme sınırları", () => {
    const a = t.opp("A");
    t.owner.touches.create({ person_id: t.person.id, opportunity_id: a.id, channel: "email", direction: "giden", summary: "ilk mesaj" });
    expect(stageOf(t.sql, a.id)).toBe("temas");
    t.owner.touches.create({ person_id: t.person.id, opportunity_id: a.id, channel: "email", direction: "gelen", summary: "cevap geldi" });
    expect(stageOf(t.sql, a.id)).toBe("cevap");
    // cevap aşamasındayken gelen/giden temas aşamayı değiştirmez
    t.owner.touches.create({ person_id: t.person.id, opportunity_id: a.id, channel: "email", direction: "gelen", summary: "bir daha" });
    expect(stageOf(t.sql, a.id)).toBe("cevap");
    // görüşme türü teklif öncesindeki fırsatı gorusme aşamasına taşır
    t.owner.touches.create({ person_id: t.person.id, opportunity_id: a.id, channel: "telefon", direction: "giden", kind: "gorusme", summary: "kapsam görüşmesi" });
    expect(stageOf(t.sql, a.id)).toBe("gorusme");

    // teklif aşamasındaki fırsata temas aşamayı değiştirmez; bulundu + gelen de değiştirmez
    const b = t.opp("B");
    t.owner.opportunities.move(b.id, { stage: "teklif" });
    t.owner.touches.create({ person_id: t.person.id, opportunity_id: b.id, channel: "telefon", direction: "giden", summary: "arama" });
    t.owner.touches.create({ person_id: t.person.id, opportunity_id: b.id, channel: "telefon", direction: "giden", kind: "gorusme", summary: "görüşme" });
    expect(stageOf(t.sql, b.id)).toBe("teklif");
    const c = t.opp("C");
    t.owner.touches.create({ person_id: t.person.id, opportunity_id: c.id, channel: "email", direction: "gelen", summary: "kendisi yazdı" });
    expect(stageOf(t.sql, c.id)).toBe("bulundu");
  });

  it("5. kim yaptı giriş noktasından gelir, girdiden değil", () => {
    const p = t.claude.people.create({ name: "Zeynep", created_by: "owner" } as any).row;
    expect(p.created_by).toBe("claude");
    const o = t.claude.opportunities.create({ title: "Z", person_id: p.id, source_id: t.source.id, created_by: "owner" } as any).row;
    expect(o.created_by).toBe("claude");
    t.claude.opportunities.move(o.id, { stage: "teklif" });
    const ev = t.sql("SELECT created_by FROM events WHERE type = 'opp.stage'");
    expect(ev).toEqual([{ created_by: "claude" }]);
    const own = t.owner.people.create({ name: "Mert", created_by: "claude" } as any).row;
    expect(own.created_by).toBe("owner");

    // MCP'nin kullandığı genel save yolu (isimle referans) da girdideki created_by'ı yok sayar
    const touch = t.claude.save("touch", { person: "Zeynep", channel: "email", direction: "giden", summary: "selam", created_by: "owner" }).row;
    const c = t.claude.save("comment", { target_type: "person", target_id: p.id, body: "not", created_by: "owner" }).row;
    expect([touch.created_by, c.created_by]).toEqual(["claude", "claude"]);
    expect(t.sql("SELECT DISTINCT created_by FROM events WHERE type IN ('touch.created','comment.created')")).toEqual([{ created_by: "claude" }]);
  });

  it("6. fiyat tabanı ve aylık rapor (kısmi ödeme ödendiği aya yazılır)", () => {
    t.owner.settings.setMany({ bagkur_monthly: 5000, accounting_monthly: 1000, other_fixed_monthly: 2000, target_net_monthly: 22000 });
    expect(t.owner.reports.priceFloor().floor).toBe(30000);
    t.owner.settings.set("tax_rate_percent", 25);
    expect(t.owner.reports.priceFloor().floor).toBe(40000); // 30000 / 0.75

    const proj = t.owner.projects.create({ name: "P", person_id: t.person.id, price: 100000 }).row;
    const pays = t.sql("SELECT id, milestone FROM payments WHERE project_id = ? ORDER BY id", proj.id);
    t.owner.payments.pay(pays[0].id, 40000, "2026-10-05");
    t.owner.payments.pay(pays[1].id, 10000, "2026-10-20"); // kısmi, ekim
    t.owner.payments.pay(pays[1].id, 15000, "2026-11-03"); // aynı taksitin kalanı, kasım
    t.owner.payments.pay(pays[2].id, 5000, "2026-11-02");

    const oct = t.owner.reports.month("2026-10");
    expect(oct).toMatchObject({ collected: 50000, floor: 40000, gap: 10000 });
    expect(t.owner.reports.month("2026-11")).toMatchObject({ collected: 20000, gap: -20000 });
    expect(() => t.owner.payments.pay(pays[2].id, 99999)).toThrow(/Kalan/);

    // düzeltme: yanlış girilen ödeme elle düzeltilince rapor da düzelir (ekim 10.000 → 0, kasım 15.000 → 20.000)
    t.owner.payments.update(pays[1].id, { paid_amount: 20000, paid_at: "2026-11-10" });
    expect(t.owner.reports.month("2026-10").collected).toBe(40000);
    expect(t.owner.reports.month("2026-11").collected).toBe(25000);
  });

  it("7. kaynak dönüşüm oranı: kazanılan / kapanan, açıklar paydaya girmez", () => {
    const r10 = t.source;
    const list = t.owner.sources.create({ name: "Ajans listesi", kind: "liste" }).row;
    const mk = (title: string, s: number) => t.opp(title, 1000, t.person.id, s);
    const [a, b, c] = [mk("a", r10.id), mk("b", r10.id), mk("c", r10.id)];
    mk("açık", r10.id);
    t.owner.opportunities.move(a.id, { stage: "kazanildi" });
    t.owner.opportunities.move(b.id, { stage: "kaybedildi", reason: "x" });
    t.owner.opportunities.move(c.id, { stage: "kaybedildi", reason: "y" });
    const z = mk("z", list.id);
    t.owner.opportunities.move(z.id, { stage: "kazanildi" });

    const rows = t.owner.reports.bySource();
    const r = rows.find((x) => x.source === "R10")!;
    expect(r).toMatchObject({ total: 4, won: 1, lost: 2, open: 1 });
    expect(r.conversion).toBeCloseTo(1 / 3);
    expect(rows.find((x) => x.source === "Ajans listesi")!.conversion).toBe(1);
  });

  it("8. peşinat bloğu: ödenmeden proje ilerlemez, ödenince ilerler", () => {
    const o = t.opp();
    t.owner.opportunities.move(o.id, { stage: "kazanildi" });
    const proj = t.sql("SELECT id FROM projects")[0];
    expect(() => t.owner.projects.move(proj.id, { stage: "tasarim_onayi" })).toThrow(/Peşinat/);
    const dep = t.sql("SELECT id, expected_amount FROM payments WHERE milestone = 'pesinat'")[0];
    t.owner.payments.pay(dep.id, dep.expected_amount - 1);
    expect(() => t.owner.projects.move(proj.id, { stage: "tasarim_onayi" })).toThrow(/Peşinat/);
    t.owner.payments.pay(dep.id, 1);
    t.owner.projects.move(proj.id, { stage: "tasarim_onayi" });
    expect(t.sql("SELECT stage FROM projects WHERE id = ?", proj.id)[0].stage).toBe("tasarim_onayi");
    // geri almak ve iptal serbest
    t.owner.projects.move(proj.id, { stage: "pesinat" });
    t.owner.projects.move(proj.id, { stage: "iptal" });

    // fiyatsız proje: peşinat planı yok, yine ilerleyemez; Claude da aynı kurala tabi
    const bare = t.owner.projects.create({ name: "Fiyatsız", person_id: t.person.id }).row;
    expect(() => t.claude.move("project", bare.id, "tasarim_onayi")).toThrow(/Peşinat/);
    expect(() => t.claude.save("project", { stage: "yayin" }, bare.id)).toThrow(/move/);
  });

  it("9. yorumlar: cevapsız konu Claude'a görünür, cevap yazınca düşer", () => {
    const first = t.owner.comments.add({ target_type: "person", target_id: t.person.id, body: "Bu kişiyi ajans olarak etiketle mi?" }).row;
    expect(first.created_by).toBe("owner");
    expect(t.claude.find("comment", { filter: { unanswered: true } }).rows.map((x) => x.id)).toEqual([first.id]);

    const reply = t.claude.comments.add({ reply_to: first.id, body: "Etiketledim." }).row;
    expect(reply).toMatchObject({ created_by: "claude", parent_id: first.id, target_type: "person" });
    expect(t.claude.find("comment", { filter: { unanswered: true } }).total).toBe(0);

    // Kullanıcı tekrar yazınca konu yine cevapsız; kapatılınca listeden düşer
    t.owner.comments.add({ reply_to: reply.id, body: "Teşekkürler, bir de e-posta ekle" });
    expect(t.claude.find("comment", { filter: { unanswered: true } }).total).toBe(1);
    t.claude.comments.resolve(first.id);
    expect(t.claude.find("comment", { filter: { unanswered: true } }).total).toBe(0);
    expect(() => t.claude.comments.update(first.id, { body: "başkasının yorumu" })).toThrow(FFError);

    // kapalı konuya kullanıcı yazınca konu açılır ve yine cevapsız olur
    const again = t.owner.comments.add({ reply_to: first.id, body: "Unuttum, telefonu da ekle" });
    expect(again.effects).toContain("konu yeniden açıldı");
    expect(t.claude.find("comment", { filter: { unanswered: true } }).total).toBe(1);
    // Claude, kullanıcının yorumunu silerek listeden düşüremez
    expect(() => t.claude.remove("comment", again.row.id)).toThrow(FFError);
    expect(() => t.claude.remove("comment", first.id)).toThrow(FFError);
    expect(t.claude.find("comment", { filter: { unanswered: true } }).total).toBe(1);
  });

  it("10. sektör iki seviye: yol açılır, üçüncü seviye ve döngü reddedilir, ana sektör alt sektörleri kapsar", () => {
    const p = t.owner.people.create({ name: "Dt. Elif", sector: "Sağlık > Diş hekimi" } as any).row;
    const sectorOf = (pid: number) => t.sql("SELECT sector_id FROM person_sectors WHERE person_id = ?", pid)[0].sector_id;
    const sec = t.sql("SELECT s.name, p.name AS parent FROM sectors s LEFT JOIN sectors p ON p.id = s.parent_id WHERE s.id = ?", sectorOf(p.id))[0];
    expect(sec).toEqual({ name: "Diş hekimi", parent: "Sağlık" });
    // aynı yol yeni sektör açmaz; tek ad var olanı bulur (büyük/küçük harf duyarsız)
    t.claude.save("person", { name: "Dt. Can", sector: "diş hekimi" });
    expect(t.sql("SELECT COUNT(*) n FROM sectors")[0].n).toBe(2);
    const vet = t.owner.people.create({ name: "Vet Ali", sector: "Sağlık > Veteriner" } as any).row;
    t.owner.people.create({ name: "Kafe Ayşe", sector: "Yeme içme > Kafe" } as any);

    expect(() => t.owner.people.create({ name: "X", sector: "A > B > C" } as any)).toThrow(/iki seviye/);
    const dis = sectorOf(p.id);
    expect(() => t.owner.sectors.create({ name: "Ortodonti", parent_id: dis })).toThrow(/iki seviye/);
    const health = t.sql("SELECT id FROM sectors WHERE name = 'Sağlık'")[0].id;
    const food = t.sql("SELECT id FROM sectors WHERE name = 'Yeme içme'")[0].id;
    expect(() => t.owner.sectors.update(health, { parent_id: food })).toThrow(/iki seviye/);
    expect(() => t.owner.sectors.update(health, { parent_id: health })).toThrow(/kendi/);

    const names = t.owner.find("person", { filter: { sector: health } }).rows.map((x) => x.name).sort();
    expect(names).toEqual(["Dt. Can", "Dt. Elif", "Vet Ali"]);
    expect(t.owner.find("person", { filter: { sector: "Veteriner" } }).rows.map((x) => x.id)).toEqual([vet.id]);

    // Paket 3: sektör silinince kayıtta kalır, yeni kayda seçilemez; geri yüklenince seçilir
    t.owner.remove("sector", dis);
    expect(t.owner.get("person", p.id).row.sector_path).toBe("Sağlık > Diş hekimi");
    expect(() => t.owner.people.create({ name: "Yeni Dt", sectors: ["Sağlık > Diş hekimi"] })).toThrow(/silinmiş/);
    t.owner.restore("sector", dis);
    expect(t.owner.people.create({ name: "Yeni Dt", sectors: ["Sağlık > Diş hekimi"] }).row.id).toBeTruthy();
  });

  it("11. cevap bekleyen ve soğuyan bağlantılar (fırsatsız temas)", () => {
    const at = (d: string) => `${d}T09:00:00Z`;
    const ayse = t.owner.people.create({ name: "Ayşe" }).row;
    // fırsatsız giden mesajlar: cevap bekliyor, kanal = son mesajın kanalı, gün = son mesajdan beri
    t.owner.touches.create({ person_id: ayse.id, channel: "email", direction: "giden", summary: "tanışma", happened_at: at("2026-10-01") });
    t.owner.touches.create({ person_id: ayse.id, channel: "linkedin", direction: "giden", summary: "hatırlatma", happened_at: at("2026-10-04") });
    expect(t.sql("SELECT opportunity_id FROM touches WHERE person_id = ?", ayse.id).every((r) => r.opportunity_id === null)).toBe(true);
    let net = t.owner.network();
    const a = net.awaiting.rows.find((r) => r.id === ayse.id)!;
    expect(a.awaiting).toMatchObject({ channel: "linkedin", days: 5, attempts: 2, late: true });
    // arama cevap beklemez
    const mert = t.owner.people.create({ name: "Mert" }).row;
    t.owner.touches.create({ person_id: mert.id, channel: "telefon", kind: "arama", direction: "giden", summary: "aradım", happened_at: at("2026-10-08") });
    expect(t.owner.network().awaiting.rows.map((r) => r.id)).toEqual([ayse.id]);
    // gelen temas düşürür
    t.owner.touches.create({ person_id: ayse.id, channel: "linkedin", direction: "gelen", summary: "döndü", happened_at: at("2026-10-06") });
    expect(t.owner.network().awaiting.total).toBe(0);
    // expects_reply kapatılınca da düşer
    const thanks = t.owner.touches.create({ person_id: mert.id, channel: "whatsapp", direction: "giden", summary: "teşekkürler", happened_at: at("2026-10-09") }).row;
    expect(t.owner.network().awaiting.total).toBe(1);
    t.claude.save("touch", { expects_reply: false }, thanks.id);
    expect(t.owner.network().awaiting.total).toBe(0);

    // soğuyan: bağlantı (gelen teması var) + 30 günden eski son temas
    const old = t.owner.people.create({ name: "Eski Dost" }).row;
    t.owner.touches.create({ person_id: old.id, channel: "yuz_yuze", kind: "gorusme", direction: "gelen", summary: "kahve", happened_at: at("2026-08-20") });
    // hiç cevap vermemiş soğuk aday soğuyan sayılmaz
    const cold = t.owner.people.create({ name: "Soğuk Aday" }).row;
    t.owner.touches.create({ person_id: cold.id, channel: "email", kind: "arama", direction: "giden", summary: "x", happened_at: at("2026-08-01") });
    net = t.owner.network();
    expect(net.cooling.rows.map((r) => r.id)).toEqual([old.id]);
    expect(net.cooling.rows[0].days_since).toBe(50);
    // takip tarihi girilince ya da yeni temas olunca düşer
    t.owner.people.update(old.id, { next_follow_up_at: "2026-10-20" });
    expect(t.owner.network().cooling.total).toBe(0);
    t.owner.people.update(old.id, { next_follow_up_at: null });
    expect(t.owner.network().cooling.total).toBe(1);
    t.owner.touches.create({ person_id: old.id, channel: "instagram", direction: "gelen", summary: "story yanıtı", happened_at: at("2026-10-07") });
    expect(t.owner.network().cooling.total).toBe(0);
  });

  it("12. referans değeri: tanıttıklarının (alt ağaç dahil) fırsat ve işleri", () => {
    const ref = t.owner.people.create({ name: "Tanıtan" }).row;
    const b = t.owner.people.create({ name: "B", referred_by_id: ref.id }).row;
    const c = t.owner.people.create({ name: "C", referred_by_id: b.id }).row;
    t.owner.people.create({ name: "D", referred_by_id: ref.id });
    const ob = t.opp("B işi", 40000, b.id);
    t.opp("B ikinci", 10000, b.id);
    const oc = t.opp("C işi", 25000, c.id);
    t.opp("C açık", 5000, c.id);
    t.owner.opportunities.move(ob.id, { stage: "kazanildi" });
    t.owner.opportunities.move(oc.id, { stage: "kaybedildi", reason: "bütçe" });
    const dep = t.sql("SELECT id, expected_amount FROM payments WHERE milestone = 'pesinat'")[0];
    t.owner.payments.pay(dep.id, dep.expected_amount);

    const v = t.owner.reports.referrals().find((r) => r.person_id === ref.id)!;
    expect(v).toMatchObject({ direct: 2, network: 3, opps: 4, won: 1, won_value: 40000, open_value: 15000, projects: 1, collected: 16000 });
    expect(t.owner.reports.referrals().find((r) => r.person_id === b.id)).toMatchObject({ direct: 1, network: 1, opps: 2, won: 0, open_value: 5000 });
    expect(t.owner.personCard(ref.id).referral_value).toMatchObject({ won_value: 40000 });
  });
});

suite("Paket 2: pazarlama kuralları", () => {
  // gün ilerleyebilen saat
  let day = "2026-10-09";
  const clock: Clock = { today: () => day, now: () => `${day}T10:00:00Z` };
  const at = (d: string) => `${d}T09:00:00Z`;
  let owner: ReturnType<typeof appFor>;
  let claude: ReturnType<typeof appFor>;
  let sql: <T = any>(q: string, ...a: unknown[]) => T[];
  beforeEach(() => {
    day = "2026-10-09";
    const h = openDb(":memory:");
    owner = appFor(h, "owner", clock);
    claude = appFor(h, "claude", clock);
    sql = (q, ...a) => h.sqlite.prepare(q).all(...a) as any[];
  });

  it("13. takip dizisi: 3. ve 7. günde takip taslağı, tekrar üretmez, cevap gelince durur, süre ayardan değişir", () => {
    const co = owner.companies.create({ name: "Örnek Diş" }).row;
    const z = owner.people.create({ name: "Zeynep Kaya", company_id: co.id }).row;
    const y = owner.people.create({ name: "Yeni" }).row;
    owner.touches.create({ person_id: z.id, channel: "email", direction: "giden", summary: "tanışma", happened_at: at("2026-10-06") });
    owner.touches.create({ person_id: y.id, channel: "linkedin", direction: "giden", summary: "selam", happened_at: at("2026-10-08") });

    // ayar 5,10 iken 3 günlük mesaj henüz takip istemez
    owner.save("setting", { followup_days: "5,10" });
    expect(claude.followups.due()).toHaveLength(0);
    owner.save("setting", { followup_days: [3, 7] });
    expect(claude.followups.due().map((f) => [f.person_id, f.step, f.days])).toEqual([[z.id, 1, 3]]);

    // 1. takip: şablon yoksa varsayılan metin, Claude adına, neden yazılı
    const g1 = claude.followups.generate();
    expect(g1.created).toHaveLength(1);
    const d1 = sql("SELECT * FROM drafts")[0];
    expect(d1).toMatchObject({ person_id: z.id, channel: "email", followup_step: 1, created_by: "claude", status: "bekliyor" });
    expect(d1.body).toContain("Merhaba Zeynep");
    expect(d1.reason).toContain("1/2");
    // bekleyen taslak varken ikinci kez üretilmez
    expect(claude.followups.generate().created).toHaveLength(0);

    // gönderildi: 2. deneme olur; 7. güne kadar 2. takip gelmez
    owner.drafts.markSent(d1.id);
    expect(claude.followups.due()).toHaveLength(0);
    day = "2026-10-13";
    const tpl = owner.templates.create({ name: "E-posta takip", kind: "takip", channel: "email", body: "Selam {ad}, {firma} için son kez yazıyorum." }).row;
    // Zeynep 7. gün → 2. takip (şablonla); Yeni'nin mesajı 5 günlük → 1. takip
    const g2 = claude.followups.generate();
    expect(g2.created.map((c) => [c.person_id, c.step])).toEqual([[z.id, 2], [y.id, 1]]);
    const d2 = sql("SELECT * FROM drafts WHERE followup_step = 2")[0];
    expect(d2).toMatchObject({ template_id: tpl.id, body: "Selam Zeynep, Örnek Diş için son kez yazıyorum." });

    // reddedilen adım tekrar üretilmez; dizi bitince (2 adım) yeni taslak yok
    owner.drafts.reject(d2.id, "gerek yok");
    expect(claude.followups.generate().created.filter((c) => c.person_id === z.id)).toHaveLength(0);

    // gelen temas diziyi durdurur: Yeni'nin taslağı silinse de yeniden üretilmez
    owner.touches.create({ person_id: y.id, channel: "linkedin", direction: "gelen", summary: "döndü", happened_at: at("2026-10-12") });
    owner.remove("draft", sql("SELECT id FROM drafts WHERE person_id = ?", y.id)[0].id);
    expect(claude.followups.due()).toHaveLength(0);
    // takip kapatılabilir
    owner.save("setting", { followup_days: "" });
    expect(claude.followups.due()).toHaveLength(0);
  });

  it("15. fikir ilgi ölçümü ve sektör/kanala göre şablon seçimi", () => {
    const idea = claude.save("idea", { title: "Klinik randevu botu", problem: "telefonla randevu kaçıyor", sectors: ["Sağlık > Diş hekimi"] }).row;
    const ayse = owner.people.create({ name: "Ayşe Demir", sector: "Sağlık > Diş hekimi" } as any).row;
    const can = owner.people.create({ name: "Can" }).row;
    // fikir hakkındaki temas kişiyi "anlatıldı" olarak bağlar
    owner.touches.create({ person_id: ayse.id, channel: "instagram", direction: "giden", summary: "botu anlattım", idea_id: idea.id });
    claude.save("interest", { idea: "randevu botu", person: "Ayşe", interest: "ilgilendi", note: "demo istedi" });
    claude.save("interest", { idea: idea.id, person: can.id });
    let st = owner.find("idea").rows[0];
    expect(st).toMatchObject({ told: 2, interested: 1, interest_rate: 0.5, touch_count: 1 });
    expect(st.sectors.map((s: any) => s.path)).toEqual(["Sağlık > Diş hekimi"]);
    expect(owner.find("idea", { filter: { sector: "Sağlık" } }).total).toBe(1);
    owner.move("idea", idea.id, "demo");
    expect(sql("SELECT type FROM events WHERE type = 'idea.stage'")).toHaveLength(1);
    expect(() => owner.move("idea", idea.id, "uçuyor")).toThrow(/aşama/);

    // şablon: aynı kanal + alt sektör > ana sektör > genel; başka kanal gelmez
    const T = (name: string, channel: string | null, sector: string | null) => owner.save("template", { name, channel, sector, body: `Merhaba {ad}, ${name}` }).row;
    const general = T("Genel", null, null);
    T("E-posta", "email", null);
    const parent = T("Sağlık LinkedIn", "linkedin", "Sağlık");
    const sub = T("Diş LinkedIn", "linkedin", "Sağlık > Diş hekimi");
    expect(owner.templates.suggest({ person_id: ayse.id }, "linkedin").map((t) => t.id)).toEqual([sub.id, parent.id, general.id]);
    expect(owner.templates.suggest({ person_id: can.id }, "linkedin").map((t) => t.id)).toEqual([general.id]);
    // şablonla taslak: metin kişiye uygulanır
    const d = claude.save("draft", { person: "Ayşe", channel: "linkedin", template: sub.id }).row;
    expect(d.body).toBe("Merhaba Ayşe, Diş LinkedIn");
    st = owner.find("template", { filter: { channel: "linkedin" } }).rows.find((t: any) => t.id === sub.id);
    expect(st.used).toBe(1);
  });
});

suite("fırsat detay: teklifler", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => { t = setup(); });

  it("tek kabul edilmiş teklif: kabul diğerlerini temizler ve fırsat değerini teklif tutarına çeker", () => {
    const o = t.opp("Örnek Pizza", 50000);
    const v1 = t.owner.offers.create({ opportunity_id: o.id, amount: 60000, items: [{ label: "Site", amount: 60000 }] }).row;
    const v2 = t.owner.offers.create({ opportunity_id: o.id, amount: 80000 }).row;
    expect([v1.version, v2.version]).toEqual([1, 2]);

    t.owner.offers.update(v1.id, { accepted: true });
    expect(t.sql("SELECT estimated_value FROM opportunities WHERE id = ?", o.id)[0].estimated_value).toBe(60000);

    t.owner.offers.update(v2.id, { accepted: true });
    expect(t.sql("SELECT id FROM offers WHERE opportunity_id = ? AND accepted_at IS NOT NULL", o.id)).toEqual([{ id: v2.id }]);
    expect(t.sql("SELECT estimated_value FROM opportunities WHERE id = ?", o.id)[0].estimated_value).toBe(80000);
    expect(t.sql("SELECT type FROM events WHERE type = 'offer.accepted'")).toHaveLength(2);
  });

  it("kazanınca ödeme planı kabul edilen teklif tutarından çıkar", () => {
    const o = t.opp("Örnek Pizza", 50000);
    const offer = t.owner.offers.create({ opportunity_id: o.id, amount: 80000 }).row;
    t.owner.offers.update(offer.id, { accepted: true });
    // fırsat değeri sonradan elle değişse de kabul edilen teklif belirleyici
    t.owner.opportunities.update(o.id, { estimated_value: 50000 });

    t.owner.opportunities.move(o.id, { stage: "kazanildi" });
    expect(t.sql("SELECT price FROM projects")[0].price).toBe(80000);
    expect(t.sql("SELECT expected_amount FROM payments ORDER BY id").map((p) => p.expected_amount)).toEqual([32000, 24000, 24000]);
  });
});

suite("haftalık aktivite", () => {
  it("günlük dilimler temasın yanında oluşturulan taslak ve teklif sayısını da verir", () => {
    const t = setup("2026-10-09");
    const o = t.opp();
    const at = (day: string) => `${day}T10:00:00Z`;
    t.owner.touches.create({ contact: "a@x.com", channel: "email", direction: "giden", summary: "mail", happened_at: at("2026-10-09") });
    t.claude.drafts.create({ person_id: t.person.id, channel: "email", body: "bir" });
    t.claude.drafts.create({ person_id: t.person.id, channel: "email", body: "iki" });
    t.owner.offers.create({ opportunity_id: o.id, amount: 1000 });
    // geçmiş güne yazılmış kayıtlar kendi dilimine düşer
    t.handle.sqlite.prepare("UPDATE drafts SET created_at = ? WHERE body = 'iki'").run(at("2026-10-07"));
    t.handle.sqlite.prepare("UPDATE offers SET created_at = ?").run(at("2026-10-08"));

    const a = t.owner.reports.activity("day");
    const day = (iso: string) => a.buckets.find((b) => b.start === iso)!;
    expect(day("2026-10-09")).toMatchObject({ sent: 1, drafts: 1, offers: 0 });
    expect(day("2026-10-08")).toMatchObject({ drafts: 0, offers: 1 });
    expect(day("2026-10-07")).toMatchObject({ drafts: 1, offers: 0 });
  });
});
