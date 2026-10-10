import { beforeEach, describe, expect, it } from "vitest";
import { createCore, openDb, type Clock } from "../src";

describe("Kendi projelerim", () => {
  const clock: Clock = { today: () => "2026-10-10", now: () => "2026-10-10T10:00:00Z" };
  let c: ReturnType<typeof createCore>;
  let sql: <T = any>(q: string, ...a: unknown[]) => T[];
  beforeEach(() => {
    const h = openDb(":memory:");
    c = createCore(h, "ozgur", clock);
    sql = (q, ...a) => h.sqlite.prepare(q).all(...a) as any[];
  });
  const pos = (project: number, prio: string) =>
    sql("SELECT title, position FROM ideas WHERE own_project_id = ? AND priority = ? AND done_at IS NULL ORDER BY position", project, prio).map((r) => `${r.title}:${r.position}`);

  it("20. kendi projesi: sektörle açılır, satılabilir varsayılanı belki, durum olayı yazılır, filtreler bulur", () => {
    const p = c.save("own_project", { name: "Full Follow", sectors: ["Yazılım > SaaS"] }).row;
    expect(p.sellable).toBe("belki");
    expect(sql("SELECT name FROM sectors ORDER BY id").map((s) => s.name)).toEqual(["Yazılım", "SaaS"]);
    c.move("own_project", p.id, "beklemede");
    expect(sql("SELECT summary FROM events WHERE type = 'own_project.status'")).toHaveLength(1);
    for (const filter of [{ status: "beklemede" }, { sellable: "belki" }, { sector: "Yazılım" }]) {
      expect(c.find("own_project", { filter }).rows.map((r) => r.name)).toEqual(["Full Follow"]);
    }
    expect(c.find("own_project", { filter: { status: "aktif" } }).rows).toHaveLength(0);
  });

  it("21. fikir kapsamı: proje fikri üst fikir almaz, alt fikirli fikir projeye girmez, genele dönünce done_at silinir", () => {
    const p = c.save("own_project", { name: "Full Follow" }).row;
    const top = c.save("idea", { title: "AI danışmanlığı" }).row;
    const i1 = c.save("idea", { title: "Fikir A", own_project: "Full Follow" }).row;
    expect(i1.own_project_id).toBe(p.id);
    expect(i1.parent_id).toBeNull();
    expect(() => c.save("idea", { title: "X", own_project_id: p.id, parent_id: top.id })).toThrow(/üst fikrin altına/);
    c.save("idea", { title: "Alt", parent: "AI danışmanlığı" });
    expect(() => c.save("idea", { own_project: "Full Follow" }, top.id)).toThrow(/alt fikirleri olan/);
    expect(() => c.save("idea", { title: "Y", parent_id: i1.id })).toThrow(/proje fikri üst fikir olamaz/);
    c.save("idea", { done: true }, i1.id);
    const back = c.save("idea", { own_project_id: null }, i1.id).row;
    expect(back.own_project_id).toBeNull();
    expect(back.done_at).toBeNull();
    expect(() => c.save("idea", { priority: "yuksek" }, i1.id)).toThrow(/sadece proje fikirlerinde/);
  });

  it("22. sıralama: öncelik grubunda sıra, sürükleme, öncelik değişimi ve yapıldı", () => {
    const p = c.save("own_project", { name: "P" }).row;
    const ids = ["a", "b", "c"].map((t) => c.save("idea", { title: t, own_project_id: p.id }).row.id);
    expect(pos(p.id, "orta")).toEqual(["a:0", "b:1", "c:2"]);
    c.save("idea", { position: 0 }, ids[2]);
    expect(pos(p.id, "orta")).toEqual(["c:0", "a:1", "b:2"]);
    c.save("idea", { priority: "yuksek", position: 0 }, ids[0]);
    expect(pos(p.id, "yuksek")).toEqual(["a:0"]);
    expect(pos(p.id, "orta")).toEqual(["c:0", "b:1"]);
    c.save("idea", { done: true }, ids[2]);
    expect(pos(p.id, "orta")).toEqual(["b:0"]);
    c.save("idea", { done: false }, ids[2]);
    expect(pos(p.id, "orta")).toEqual(["b:0", "c:1"]);
  });

  it("23. fikirden proje: alt fikirler taşınır, kaynak fikir çöpe gider; proje silinince fikirler genele döner, geri yüklenince bağlanır", () => {
    const src = c.save("idea", { title: "Full Follow", sectors: ["Yazılım"] }).row;
    const k1 = c.save("idea", { title: "Alt 1", parent_id: src.id }).row;
    const k2 = c.save("idea", { title: "Alt 2", parent_id: src.id }).row;
    const { row: p } = c.save("own_project", { from_idea: "Full Follow" });
    expect(c.get("own_project", p.id).row.sectors.map((s: any) => s.path)).toEqual(["Yazılım"]);
    expect(sql("SELECT id, parent_id, own_project_id, position FROM ideas ORDER BY id")).toEqual([
      { id: k1.id, parent_id: null, own_project_id: p.id, position: 0 },
      { id: k2.id, parent_id: null, own_project_id: p.id, position: 1 },
    ]);
    expect(sql("SELECT record_id FROM trash WHERE type = 'idea'")).toEqual([{ record_id: src.id }]);
    c.restore("idea", src.id);
    expect(sql("SELECT parent_id, own_project_id FROM ideas WHERE id = ?", src.id)).toEqual([{ parent_id: null, own_project_id: null }]);
    expect(sql("SELECT COUNT(*) n FROM ideas WHERE parent_id = ?", src.id)[0].n).toBe(0);

    c.remove("own_project", p.id);
    expect(sql("SELECT own_project_id FROM ideas WHERE id IN (?, ?)", k1.id, k2.id)).toEqual([{ own_project_id: null }, { own_project_id: null }]);
    c.restore("own_project", p.id);
    expect(sql("SELECT own_project_id FROM ideas WHERE id IN (?, ?)", k1.id, k2.id)).toEqual([{ own_project_id: p.id }, { own_project_id: p.id }]);
  });
});
