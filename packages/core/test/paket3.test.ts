import { beforeEach, describe, expect, it } from "vitest";
import { createCore, FFError, openDb, type Clock } from "../src";

describe("Paket 3: firma, etiket, mükerrer, çöp kutusu", () => {
  let day = "2026-10-09";
  const clock: Clock = { today: () => day, now: () => `${day}T10:00:00Z` };
  const at = (d: string) => `${d}T09:00:00Z`;
  let ozgur: ReturnType<typeof createCore>;
  let claude: ReturnType<typeof createCore>;
  let sql: <T = any>(q: string, ...a: unknown[]) => T[];
  beforeEach(() => {
    day = "2026-10-09";
    const h = openDb(":memory:");
    ozgur = createCore(h, "ozgur", clock);
    claude = createCore(h, "claude", clock);
    sql = (q, ...a) => h.sqlite.prepare(q).all(...a) as any[];
  });
  const dupOf = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      if (e instanceof FFError && e.code === "duplicate") return e.duplicate;
      throw e;
    }
    throw new Error("mükerrer hatası beklendi");
  };

  it("16. mükerrer: e-posta, alan adı, firma adı, LinkedIn ve Instagram normalize edilip tek tutulur; ad soyad tekrar edebilir", () => {
    const co = ozgur.companies.create({ name: "ABC Yazılım Ltd. Şti.", website: "https://www.abc.com.tr/iletisim", linkedin: "linkedin.com/company/abc" }).row;
    expect(dupOf(() => ozgur.companies.create({ name: "abc yazilim ltd sti" }))).toMatchObject({ type: "company", id: co.id, field: "firma adı", in_trash: false });
    expect(dupOf(() => claude.save("company", { name: "Başka", website: "abc.com.tr" }))).toMatchObject({ id: co.id, field: "alan adı" });
    expect(dupOf(() => claude.save("company", { name: "Başka", linkedin: "https://tr.linkedin.com/company/ABC/" }))).toMatchObject({ field: "LinkedIn" });

    const p = ozgur.people.create({ name: "Ali Veli", email: " Ali.Veli@Örnek.com ", instagram: "@aliveli" }).row;
    expect(dupOf(() => claude.save("person", { name: "Başkası", email: "ali.veli@ornek.com" }))).toMatchObject({ type: "person", id: p.id, field: "e-posta" });
    expect(dupOf(() => ozgur.people.create({ name: "X", instagram: "https://www.instagram.com/AliVeli/" }))).toMatchObject({ field: "Instagram" });
    // e-posta kişi ile firma arasında da tektir
    expect(dupOf(() => ozgur.companies.create({ name: "Örnek", email: "ali.veli@ornek.com" }))).toMatchObject({ type: "person", id: p.id });
    // ad soyad tekrar edebilir; kendi kaydını güncellemek çakışma sayılmaz
    expect(ozgur.people.create({ name: "Ali Veli" }).row.id).not.toBe(p.id);
    expect(ozgur.people.update(p.id, { email: "ALI.VELI@ornek.com", phone: "0555" }).row.phone).toBe("0555");

    // toplu ekleme: mükerrerler atlanır ve hangi kayıtla çakıştığı döner
    const r = claude.saveMany("person", [
      { name: "Yeni 1", email: "y1@x.com", company: "Yeni Firma" },
      { name: "Kopya", email: "ali.veli@ornek.com" },
      { name: "Yeni 2", email: "y2@x.com", company: "Yeni Firma" },
      { name: "" },
    ]);
    expect(r.created.map((c) => c.label)).toEqual(["Yeni 1", "Yeni 2"]);
    expect(r.skipped).toEqual([{ index: 1, label: "Kopya", existing: expect.objectContaining({ id: p.id, field: "e-posta" }) }]);
    expect(r.failed.map((f) => f.index)).toEqual([3]);
    // firma adla verildi: bir kez açıldı, iki kişi ona bağlandı
    expect(sql("SELECT COUNT(*) n FROM people p JOIN companies c ON c.id = p.company_id WHERE c.name = 'Yeni Firma'")[0].n).toBe(2);

    // çöp kutusundaki kayıt da mükerrer sayılır (geri yüklenebilir diye işaretli)
    ozgur.remove("company", co.id);
    expect(dupOf(() => ozgur.companies.create({ name: "ABC Yazılım" }))).toMatchObject({ id: co.id, in_trash: true });
  });

  it("17. silme çöp kutusuna gider, geri yükleme kaydı alt kayıtları ve bağlarıyla aynı id'lerle getirir", () => {
    const co = ozgur.companies.create({ name: "Gülüş Diş" }).row;
    const ref = ozgur.people.create({ name: "Tanıtan" }).row;
    const p = ozgur.people.create({ name: "Zeynep", email: "z@gulus.com", company_id: co.id, referred_by_id: ref.id, tags: ["Sıcak"], sectors: ["Sağlık"] }).row;
    const kid = ozgur.people.create({ name: "Zeynep tanıttı", referred_by_id: p.id }).row;
    const t = ozgur.touches.create({ person_id: p.id, channel: "email", direction: "giden", summary: "merhaba" }).row;
    ozgur.notes.create({ person_id: p.id, body: "2 kliniği var" });
    ozgur.comments.add({ target_type: "person", target_id: p.id, body: "ne zaman ararız?" });

    const del = ozgur.remove("person", p.id);
    expect(del.trash).toEqual({ type: "person", id: p.id });
    expect(sql("SELECT COUNT(*) n FROM people WHERE id = ?", p.id)[0].n).toBe(0);
    expect(sql("SELECT referred_by_id FROM people WHERE id = ?", kid.id)[0].referred_by_id).toBeNull();
    expect(ozgur.find("trash").rows[0]).toMatchObject({ type: "person", id: p.id, label: "Zeynep" });

    ozgur.restore("person", "Zeynep");
    const back = ozgur.personCard(p.id);
    expect(back.row).toMatchObject({ id: p.id, email: "z@gulus.com", company_id: co.id, referred_by_id: ref.id, tags: ["Sıcak"], sector_path: "Sağlık" });
    expect(back.touches.rows.map((x) => x.id)).toEqual([t.id]);
    expect(back.notes).toHaveLength(1);
    expect(back.threads).toHaveLength(1);
    expect(sql("SELECT referred_by_id FROM people WHERE id = ?", kid.id)[0].referred_by_id).toBe(p.id);
    expect(ozgur.find("trash").total).toBe(0);

    // çöpteki kaydın e-postasıyla yeni kayıt açılmaz: geri yükleme önerilir
    ozgur.remove("person", p.id);
    expect(dupOf(() => ozgur.people.create({ name: "Başka Zeynep", email: "Z@gulus.com" }))).toMatchObject({ id: p.id, field: "e-posta", in_trash: true });

    // her kart türü çöp kutusundan döner (firma; görev ve paylaşım modüllerinin testinde)
    ozgur.remove("company", co.id);
    ozgur.restore("company", co.id);
    expect(sql("SELECT name FROM companies WHERE id = ?", co.id)[0].name).toBe("Gülüş Diş");
  });

  it("18. etiket veritabanında: eklenir, adı değişir (slug kalır), silinen kayıtta kalır ama yenisine seçilemez", () => {
    const tag = ozgur.tags.create({ name: "Fuar 2026", color: "source" }).row;
    expect(dupOf(() => ozgur.tags.create({ name: "fuar 2026" }))).toMatchObject({ type: "tag", id: tag.id });
    const a = ozgur.people.create({ name: "A", tags: [tag.id, "R10"] }).row;
    const co = ozgur.companies.create({ name: "Firma A", tags: ["Fuar 2026"] }).row;
    ozgur.tags.update(tag.id, { name: "Fuar İstanbul" });
    expect(sql("SELECT slug FROM tags WHERE id = ?", tag.id)[0].slug).toBe("fuar_2026");

    ozgur.remove("tag", tag.id);
    // kayıtlarda kalır, filtre çalışır
    expect(ozgur.get("person", a.id).row.tags).toEqual(["Fuar İstanbul", "R10"]);
    expect(ozgur.find("company", { filter: { tag: tag.id } }).rows.map((c) => c.id)).toEqual([co.id]);
    // kaydın kendi etiketleri kaydedilirken silinen etiket kalabilir; yeni kayda ya da yeni bağa eklenemez
    ozgur.people.update(a.id, { tags: [tag.id, "R10"], notes: "x" });
    expect(() => ozgur.people.create({ name: "B", tags: [tag.id] })).toThrow(/silinmiş/);
    const b = ozgur.companies.create({ name: "Firma B" }).row;
    expect(() => claude.save("company", { add_tags: ["Fuar İstanbul"] }, b.id)).toThrow(/silinmiş/);
    // listede görünmez, çöp kutusunda görünür; geri yüklenince seçilebilir
    expect(ozgur.find("tag").rows.map((x) => x.id)).not.toContain(tag.id);
    expect(ozgur.find("trash").rows.find((x) => x.type === "tag")).toMatchObject({ id: tag.id, label: "Fuar İstanbul" });
    ozgur.restore("tag", tag.id);
    expect(ozgur.people.create({ name: "B", tags: [tag.id] }).row.id).toBeTruthy();
    // elle çıkarılınca gider
    ozgur.people.update(a.id, { remove_tags: ["fuar istanbul"] });
    expect(ozgur.get("person", a.id).row.tags).toEqual(["R10"]);
  });

  it("19. firma: doğrudan ve çalışan temasları durumu ilerletir, adresli temas kayda bağlanır, takip ve şablon firmada çalışır", () => {
    const co = ozgur.companies.create({ name: "Gülüş Diş", email: "info@gulus.com", sectors: ["Sağlık > Diş hekimi"] }).row;
    expect(co.contact_status).toBe("yazilmadi");
    // genel adrese soğuk mail: adres firmanınki, temas firmaya bağlanır
    ozgur.touches.create({ contact: "INFO@gulus.com", channel: "email", direction: "giden", summary: "tanışma", happened_at: at("2026-10-01") });
    expect(ozgur.get("company", co.id).row.contact_status).toBe("yazildi");

    // takip dizisi firmada: 3. günde {firma} ve {sektor} dolu taslak
    ozgur.save("template", { name: "Firma takip", kind: "takip", channel: "email", body: "Merhaba {firma} ekibi, {sektor} için yazmıştım" });
    day = "2026-10-04";
    const f = claude.followups.generate();
    expect(f.created).toEqual([expect.objectContaining({ company_id: co.id, step: 1 })]);
    expect(sql("SELECT company_id, person_id, body FROM drafts")[0]).toMatchObject({ company_id: co.id, person_id: null, body: "Merhaba Gülüş Diş ekibi, Diş hekimi için yazmıştım" });
    ozgur.drafts.markSent(sql("SELECT id FROM drafts")[0].id);
    expect(sql("SELECT company_id FROM touches ORDER BY id DESC")[0].company_id).toBe(co.id);

    // çalışandan cevap: kişi ve firma "cevap geldi", firma dizisi durur
    const z = ozgur.people.create({ name: "Zeynep", company_id: co.id }).row;
    ozgur.touches.create({ person_id: z.id, channel: "email", direction: "gelen", summary: "ilgileniyoruz", happened_at: at("2026-10-05") });
    expect(ozgur.get("company", co.id).row.contact_status).toBe("cevap_geldi");
    day = "2026-10-20";
    expect(ozgur.followups.due()).toEqual([]);
    // olumsuz elle verilir, temas onu değiştirmez
    ozgur.companies.update(co.id, { contact_status: "olumsuz" });
    ozgur.touches.create({ company_id: co.id, channel: "telefon", direction: "giden", kind: "arama", summary: "aradım" });
    expect(ozgur.get("company", co.id).row.contact_status).toBe("olumsuz");

    // kişisiz, firmasız adres: sonra o adresle açılan kişiye bağlanır
    const loose = ozgur.touches.create({ contact: "mehmet@baska.com", channel: "email", direction: "giden", summary: "soğuk mail" }).row;
    expect(loose).toMatchObject({ person_id: null, company_id: null, contact: "mehmet@baska.com" });
    const m = claude.save("person", { name: "Mehmet", email: "Mehmet@Baska.com" });
    expect(m.effects).toContain("1 temas bağlandı");
    expect(ozgur.get("person", m.row.id).row.contact_status).toBe("yazildi");

    // firma kartı ve filtreler
    const card = ozgur.companyCard(co.id);
    expect(card.people.map((p) => p.id)).toEqual([z.id]);
    expect(card.touches.total).toBe(4);
    expect(ozgur.find("company", { filter: { status: "olumsuz", sector: "Sağlık" } }).rows.map((c) => c.id)).toEqual([co.id]);
    const li = ozgur.get("source", "LinkedIn").row;
    const co2 = ozgur.companies.create({ name: "LinkedIn Firması", source_id: li.id }).row;
    expect(ozgur.find("company", { filter: { source: "linkedin", status: "yazilmadi" } }).rows.map((c) => c.id)).toEqual([co2.id]);
    // silinen kaynak yeni kayda seçilemez
    ozgur.remove("source", li.id);
    expect(() => ozgur.people.create({ name: "X", source_id: li.id })).toThrow(/silinmiş/);
  });
  it("linkler: fırsat linkleri projede de görünür, fırsatla birlikte çöp kutusuna gider", () => {
    const p = ozgur.people.create({ name: "Deniz" }).row;
    const o = claude.save("opportunity", { title: "Pizza Z", person: "Deniz", source: "LinkedIn", stage: "teklif" }).row;
    const deck = claude.save("link", { target_type: "opportunity", target_id: o.id, label: "Teklif sunumu", url: "https://example.com/deck" }).row;
    expect(deck.created_by).toBe("claude");
    expect(() => claude.save("link", { target_type: "opportunity", target_id: o.id, label: "x", url: "olmayan link" })).toThrow(FFError);

    ozgur.opportunities.move(o.id, { stage: "kazanildi" });
    const project = sql<{ id: number }>("SELECT id FROM projects WHERE opportunity_id = ?", o.id)[0];
    ozgur.save("link", { target_type: "project", target_id: project.id, label: "Repo", url: "https://example.com/repo" });
    const shown = ozgur.get("project", project.id, ["links"]).related.links.map((l: any) => [l.label, l.from ?? null]);
    expect(shown).toEqual([["Teklif sunumu", "fırsat"], ["Repo", null]]);

    ozgur.remove("link", deck.id);
    expect(ozgur.get("opportunity", o.id, ["links"]).related.links).toEqual([]);
    ozgur.restore("link", deck.id);
    expect(ozgur.find("link", { filter: { opportunity_id: o.id } }).rows.map((l: any) => l.id)).toEqual([deck.id]);
    expect(p.id).toBeGreaterThan(0);
  });
  it("üst fikir: iki seviye, alt fikir üst fikrin altında listelenir", () => {
    const ff = claude.save("idea", { title: "Full Follow", stage: "urun" }).row;
    const fin = claude.save("idea", { title: "Finans modülü", parent: "Full Follow" }).row;
    expect(fin.parent_id).toBe(ff.id);
    expect(() => claude.save("idea", { title: "Alt alt", parent_id: fin.id })).toThrow(FFError);
    expect(() => claude.save("idea", { parent_id: fin.id }, ff.id)).toThrow(FFError);
    expect(ozgur.get("idea", ff.id).row.child_count).toBe(1);
    ozgur.remove("idea", ff.id);
    expect(ozgur.get("idea", fin.id).row.parent_id).toBeNull();
  });
});
