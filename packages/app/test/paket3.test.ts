import { beforeEach, describe, expect, it } from "vitest";
import { FFError, openDb, type Clock } from "@fullfollow/core";
import { appFor, suite } from "./helpers";

suite("Paket 3: firma, etiket, mükerrer, çöp kutusu", () => {
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
    const co = owner.companies.create({ name: "ABC Yazılım Ltd. Şti.", website: "https://www.abc.com.tr/iletisim", linkedin: "linkedin.com/company/abc" }).row;
    expect(dupOf(() => owner.companies.create({ name: "abc yazilim ltd sti" }))).toMatchObject({ type: "company", id: co.id, field: "firma adı", in_trash: false });
    expect(dupOf(() => claude.save("company", { name: "Başka", website: "abc.com.tr" }))).toMatchObject({ id: co.id, field: "alan adı" });
    expect(dupOf(() => claude.save("company", { name: "Başka", linkedin: "https://tr.linkedin.com/company/ABC/" }))).toMatchObject({ field: "LinkedIn" });

    const p = owner.people.create({ name: "Ali Veli", email: " Ali.Veli@Örnek.com ", instagram: "@aliveli" }).row;
    expect(dupOf(() => claude.save("person", { name: "Başkası", email: "ali.veli@ornek.com" }))).toMatchObject({ type: "person", id: p.id, field: "e-posta" });
    expect(dupOf(() => owner.people.create({ name: "X", instagram: "https://www.instagram.com/AliVeli/" }))).toMatchObject({ field: "Instagram" });
    // e-posta kişi ile firma arasında da tektir
    expect(dupOf(() => owner.companies.create({ name: "Örnek", email: "ali.veli@ornek.com" }))).toMatchObject({ type: "person", id: p.id });
    // ad soyad tekrar edebilir; kendi kaydını güncellemek çakışma sayılmaz
    expect(owner.people.create({ name: "Ali Veli" }).row.id).not.toBe(p.id);
    expect(owner.people.update(p.id, { email: "ALI.VELI@ornek.com", phone: "0555" }).row.phone).toBe("0555");

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
    owner.remove("company", co.id);
    expect(dupOf(() => owner.companies.create({ name: "ABC Yazılım" }))).toMatchObject({ id: co.id, in_trash: true });
  });

  it("17. silme çöp kutusuna gider, geri yükleme kaydı alt kayıtları ve bağlarıyla aynı id'lerle getirir", () => {
    const co = owner.companies.create({ name: "Örnek Diş" }).row;
    const ref = owner.people.create({ name: "Tanıtan" }).row;
    const p = owner.people.create({ name: "Zeynep", email: "z@ornekdis.com", company_id: co.id, referred_by_id: ref.id, tags: ["Sıcak"], sectors: ["Sağlık"] }).row;
    const kid = owner.people.create({ name: "Zeynep tanıttı", referred_by_id: p.id }).row;
    const t = owner.touches.create({ person_id: p.id, channel: "email", direction: "giden", summary: "merhaba" }).row;
    owner.notes.create({ person_id: p.id, body: "2 kliniği var" });
    owner.comments.add({ target_type: "person", target_id: p.id, body: "ne zaman ararız?" });

    const del = owner.remove("person", p.id);
    expect(del.trash).toEqual({ type: "person", id: p.id });
    expect(sql("SELECT COUNT(*) n FROM people WHERE id = ?", p.id)[0].n).toBe(0);
    expect(sql("SELECT referred_by_id FROM people WHERE id = ?", kid.id)[0].referred_by_id).toBeNull();
    expect(owner.find("trash").rows[0]).toMatchObject({ type: "person", id: p.id, label: "Zeynep" });

    owner.restore("person", "Zeynep");
    const back = owner.personCard(p.id);
    expect(back.row).toMatchObject({ id: p.id, email: "z@ornekdis.com", company_id: co.id, referred_by_id: ref.id, tags: ["Sıcak"], sector_path: "Sağlık" });
    expect(back.touches.rows.map((x) => x.id)).toEqual([t.id]);
    expect(back.notes).toHaveLength(1);
    expect(back.threads).toHaveLength(1);
    expect(sql("SELECT referred_by_id FROM people WHERE id = ?", kid.id)[0].referred_by_id).toBe(p.id);
    expect(owner.find("trash").total).toBe(0);

    // çöpteki kaydın e-postasıyla yeni kayıt açılmaz: geri yükleme önerilir
    owner.remove("person", p.id);
    expect(dupOf(() => owner.people.create({ name: "Başka Zeynep", email: "Z@ornekdis.com" }))).toMatchObject({ id: p.id, field: "e-posta", in_trash: true });

    // her kart türü çöp kutusundan döner (firma; görev ve paylaşım modüllerinin testinde)
    owner.remove("company", co.id);
    owner.restore("company", co.id);
    expect(sql("SELECT name FROM companies WHERE id = ?", co.id)[0].name).toBe("Örnek Diş");
  });

  it("18. etiket veritabanında: eklenir, adı değişir (slug kalır), silinen kayıtta kalır ama yenisine seçilemez", () => {
    const tag = owner.tags.create({ name: "Fuar 2026", color: "source" }).row;
    expect(dupOf(() => owner.tags.create({ name: "fuar 2026" }))).toMatchObject({ type: "tag", id: tag.id });
    const a = owner.people.create({ name: "A", tags: [tag.id, "R10"] }).row;
    const co = owner.companies.create({ name: "Firma A", tags: ["Fuar 2026"] }).row;
    owner.tags.update(tag.id, { name: "Fuar İstanbul" });
    expect(sql("SELECT slug FROM tags WHERE id = ?", tag.id)[0].slug).toBe("fuar_2026");

    owner.remove("tag", tag.id);
    // kayıtlarda kalır, filtre çalışır
    expect(owner.get("person", a.id).row.tags).toEqual(["Fuar İstanbul", "R10"]);
    expect(owner.find("company", { filter: { tag: tag.id } }).rows.map((c) => c.id)).toEqual([co.id]);
    // kaydın kendi etiketleri kaydedilirken silinen etiket kalabilir; yeni kayda ya da yeni bağa eklenemez
    owner.people.update(a.id, { tags: [tag.id, "R10"], notes: "x" });
    expect(() => owner.people.create({ name: "B", tags: [tag.id] })).toThrow(/silinmiş/);
    const b = owner.companies.create({ name: "Firma B" }).row;
    expect(() => claude.save("company", { add_tags: ["Fuar İstanbul"] }, b.id)).toThrow(/silinmiş/);
    // listede görünmez, çöp kutusunda görünür; geri yüklenince seçilebilir
    expect(owner.find("tag").rows.map((x) => x.id)).not.toContain(tag.id);
    expect(owner.find("trash").rows.find((x) => x.type === "tag")).toMatchObject({ id: tag.id, label: "Fuar İstanbul" });
    owner.restore("tag", tag.id);
    expect(owner.people.create({ name: "B", tags: [tag.id] }).row.id).toBeTruthy();
    // elle çıkarılınca gider
    owner.people.update(a.id, { remove_tags: ["fuar istanbul"] });
    expect(owner.get("person", a.id).row.tags).toEqual(["R10"]);
  });

  it("19. firma: doğrudan ve çalışan temasları durumu ilerletir, adresli temas kayda bağlanır, takip ve şablon firmada çalışır", () => {
    const co = owner.companies.create({ name: "Örnek Diş", email: "info@ornekdis.com", sectors: ["Sağlık > Diş hekimi"] }).row;
    expect(co.contact_status).toBe("yazilmadi");
    // genel adrese soğuk mail: adres firmanınki, temas firmaya bağlanır
    owner.touches.create({ contact: "INFO@ornekdis.com", channel: "email", direction: "giden", summary: "tanışma", happened_at: at("2026-10-01") });
    expect(owner.get("company", co.id).row.contact_status).toBe("yazildi");

    // takip dizisi firmada: 3. günde {firma} ve {sektor} dolu taslak
    owner.save("template", { name: "Firma takip", kind: "takip", channel: "email", body: "Merhaba {firma} ekibi, {sektor} için yazmıştım" });
    day = "2026-10-04";
    const f = claude.followups.generate();
    expect(f.created).toEqual([expect.objectContaining({ company_id: co.id, step: 1 })]);
    expect(sql("SELECT company_id, person_id, body FROM drafts")[0]).toMatchObject({ company_id: co.id, person_id: null, body: "Merhaba Örnek Diş ekibi, Diş hekimi için yazmıştım" });
    owner.drafts.markSent(sql("SELECT id FROM drafts")[0].id);
    expect(sql("SELECT company_id FROM touches ORDER BY id DESC")[0].company_id).toBe(co.id);

    // çalışandan cevap: kişi ve firma "cevap geldi", firma dizisi durur
    const z = owner.people.create({ name: "Zeynep", company_id: co.id }).row;
    owner.touches.create({ person_id: z.id, channel: "email", direction: "gelen", summary: "ilgileniyoruz", happened_at: at("2026-10-05") });
    expect(owner.get("company", co.id).row.contact_status).toBe("cevap_geldi");
    day = "2026-10-20";
    expect(owner.followups.due()).toEqual([]);
    // olumsuz elle verilir, temas onu değiştirmez
    owner.companies.update(co.id, { contact_status: "olumsuz" });
    owner.touches.create({ company_id: co.id, channel: "telefon", direction: "giden", kind: "arama", summary: "aradım" });
    expect(owner.get("company", co.id).row.contact_status).toBe("olumsuz");

    // kişisiz, firmasız adres: sonra o adresle açılan kişiye bağlanır
    const loose = owner.touches.create({ contact: "mehmet@baska.com", channel: "email", direction: "giden", summary: "soğuk mail" }).row;
    expect(loose).toMatchObject({ person_id: null, company_id: null, contact: "mehmet@baska.com" });
    const m = claude.save("person", { name: "Mehmet", email: "Mehmet@Baska.com" });
    expect(m.effects).toContain("1 temas bağlandı");
    expect(owner.get("person", m.row.id).row.contact_status).toBe("yazildi");

    // firma kartı ve filtreler
    const card = owner.companyCard(co.id);
    expect(card.people.map((p) => p.id)).toEqual([z.id]);
    expect(card.touches.total).toBe(4);
    expect(owner.find("company", { filter: { status: "olumsuz", sector: "Sağlık" } }).rows.map((c) => c.id)).toEqual([co.id]);
    const li = owner.get("source", "LinkedIn").row;
    const co2 = owner.companies.create({ name: "LinkedIn Firması", source_id: li.id }).row;
    expect(owner.find("company", { filter: { source: "linkedin", status: "yazilmadi" } }).rows.map((c) => c.id)).toEqual([co2.id]);
    // silinen kaynak yeni kayda seçilemez
    owner.remove("source", li.id);
    expect(() => owner.people.create({ name: "X", source_id: li.id })).toThrow(/silinmiş/);
  });
  it("linkler: fırsat linkleri projede de görünür, fırsatla birlikte çöp kutusuna gider", () => {
    const p = owner.people.create({ name: "Deniz Örnek" }).row;
    const o = claude.save("opportunity", { title: "Örnek Pizza", person: "Deniz Örnek", source: "LinkedIn", stage: "teklif" }).row;
    const deck = claude.save("link", { target_type: "opportunity", target_id: o.id, label: "Teklif sunumu", url: "https://example.com/deck" }).row;
    expect(deck.created_by).toBe("claude");
    expect(() => claude.save("link", { target_type: "opportunity", target_id: o.id, label: "x", url: "olmayan link" })).toThrow(FFError);

    owner.opportunities.move(o.id, { stage: "kazanildi" });
    const project = sql<{ id: number }>("SELECT id FROM projects WHERE opportunity_id = ?", o.id)[0];
    owner.save("link", { target_type: "project", target_id: project.id, label: "Repo", url: "https://example.com/repo" });
    const shown = owner.get("project", project.id, ["links"]).related.links.map((l: any) => [l.label, l.from ?? null]);
    expect(shown).toEqual([["Teklif sunumu", "fırsat"], ["Repo", null]]);

    owner.remove("link", deck.id);
    expect(owner.get("opportunity", o.id, ["links"]).related.links).toEqual([]);
    owner.restore("link", deck.id);
    expect(owner.find("link", { filter: { opportunity_id: o.id } }).rows.map((l: any) => l.id)).toEqual([deck.id]);
    expect(p.id).toBeGreaterThan(0);
  });
  it("üst fikir: iki seviye, alt fikir üst fikrin altında listelenir", () => {
    const ff = claude.save("idea", { title: "Full Follow", stage: "urun" }).row;
    const fin = claude.save("idea", { title: "Finans modülü", parent: "Full Follow" }).row;
    expect(fin.parent_id).toBe(ff.id);
    expect(() => claude.save("idea", { title: "Alt alt", parent_id: fin.id })).toThrow(FFError);
    expect(() => claude.save("idea", { parent_id: fin.id }, ff.id)).toThrow(FFError);
    expect(owner.get("idea", ff.id).row.child_count).toBe(1);
    owner.remove("idea", ff.id);
    expect(owner.get("idea", fin.id).row.parent_id).toBeNull();
  });
});
