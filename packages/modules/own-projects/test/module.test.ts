import { describe, expect, it } from "vitest";
import { FFError, openDb, type Clock } from "@fullfollow/core";
import { appFor, fakeIdeas, idea } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };
const events = (h: ReturnType<typeof openDb>) => h.sqlite.prepare("SELECT type FROM events ORDER BY id").all().map((e: any) => e.type);

describe("own projects as a module", () => {
  it("own projects go through the generic save, find, get, move and delete by their Turkish aliases; the filters find them", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "claude", clock);
    const p = app.save("projelerim", { name: "Full Follow", sectors: ["Yazılım > SaaS"] }).row;
    expect(p).toMatchObject({ status: "aktif", sellable: "belki", created_by: "claude" });
    expect(app.get("own_project", "Full Follow").row).toMatchObject({ id: p.id, open_ideas: 0, done_ideas: 0, sectors: [{ path: "Yazılım > SaaS" }] });
    expect(app.move("own", p.id, "beklemede").effects).toEqual(["proje → beklemede"]);
    expect(() => app.move("own_project", p.id, "uçuyor")).toThrow(/proje durumu/);
    app.save("own_project", { sellable: "evet", sellable_note: "diş klinikleri" }, p.id);
    expect(events(h)).toEqual(["sector.created", "sector.created", "own_project.created", "own_project.status", "own_project.updated"]);
    for (const filter of [{ status: "beklemede" }, { status: "aktif,beklemede" }, { sellable: "evet" }, { sector: "Yazılım" }, { sector: "SaaS" }]) {
      expect(app.find("own_project", { filter }).rows.map((r) => r.name)).toEqual(["Full Follow"]);
    }
    expect(app.find("own_project", { filter: { status: "aktif" } }).total).toBe(0);
    expect(app.find("kendi_proje", { q: "full" }).total).toBe(1);
    expect(() => app.save("own_project", { name: "x", status: "yok" })).toThrow(/status/);
    expect(() => app.save("own_project", {}, 999)).toThrow(/kendi projesi #999 bulunamadı/);
  });

  it("the list counts the open and done ideas of each project and puts active ones first", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const a = app.projects.create({ name: "A", status: "tamamlandi" }).row;
    const b = app.projects.create({ name: "B" }).row;
    idea(h, "açık 1", { own_project_id: b.id });
    idea(h, "açık 2", { own_project_id: b.id });
    idea(h, "yapıldı", { own_project_id: b.id, done: true });
    expect(app.projects.stats().map((r) => [r.name, r.open_ideas, r.done_ideas])).toEqual([["B", 2, 1], ["A", 0, 0]]);
    expect(app.projects.get(a.id)).toMatchObject({ name: "A" });
    expect(app.projects.ref(b.id)).toMatchObject({ name: "B", status: "aktif" });
    expect(app.projects.ref(999)).toBeUndefined();
  });

  it("deleting a project takes its sectors, links and comments and announces itself; restoring brings them back", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const p = app.projects.create({ name: "Full Follow", sectors: ["Yazılım"] }).row;
    app.save("link", { target_type: "own_project", target_id: p.id, label: "repo", url: "https://x.example/r" });
    app.save("comment", { target_type: "own_project", target_id: p.id, body: "not" });
    expect(app.find("comment").rows[0]).toMatchObject({ target_type: "own_project", target_label: "Full Follow" });
    expect(app.commentTargets()).toContain("own_project");
    expect(app.find("link", { filter: { own_project_id: p.id } }).total).toBe(1);
    expect(app.get("own_project", p.id, ["links", "comments"]).related.links).toHaveLength(1);
    expect(() => app.get("own_project", p.id, ["ideas"])).toThrow(/geçerli ilişkiler: links, comments/);
    expect(app.remove("own_project", p.id).trash).toEqual({ type: "own_project", id: p.id });
    for (const t of ["own_project_sectors", "links", "comments", "own_projects"]) expect(h.sqlite.prepare(`SELECT COUNT(*) n FROM ${t}`).get()).toEqual({ n: 0 });
    expect(app.find("trash").rows[0]).toMatchObject({ type: "own_project", what: "kendi projesi", label: "Full Follow" });
    app.restore("own_project", "Full Follow");
    for (const t of ["own_project_sectors", "links", "comments", "own_projects"]) expect(h.sqlite.prepare(`SELECT COUNT(*) n FROM ${t}`).get()).toEqual({ n: 1 });
  });

  it("turning an idea into a project needs the ideas module, which hands the idea over; only a top level general idea qualifies", () => {
    const h = openDb(":memory:");
    const alone = appFor(h, "ozgur", clock);
    expect(() => alone.projects.fromIdea(1)).toThrow(/"ideas" modülü kurulu olmalı/);
    expect(() => alone.save("own_project", { from_idea: "Klinik botu" })).toThrow(/"idea" türü için "ideas" modülü kurulu değil/);

    const seen: string[] = [];
    const app = appFor(h, "ozgur", clock, [fakeIdeas(seen)]);
    const top = idea(h, "Klinik botu", { problem: "randevu kaçıyor" });
    h.sqlite.prepare("UPDATE ideas SET notes = 'not' WHERE id = ?").run(top);
    const sector = Number(h.sqlite.prepare("INSERT INTO sectors (name, created_at, updated_at, created_by) VALUES ('Sağlık', ?, ?, 'ozgur')").run(clock.now(), clock.now()).lastInsertRowid);
    h.sqlite.prepare("INSERT INTO idea_sectors (idea_id, sector_id, created_at, created_by) VALUES (?, ?, ?, 'ozgur')").run(top, sector, clock.now());
    const kid = idea(h, "Alt", { parent_id: top });
    const r = app.save("own_project", { from_idea: "Klinik botu" });
    expect(r.row).toMatchObject({ name: "Klinik botu", description: "randevu kaçıyor", notes: "not", status: "aktif", sellable: "belki" });
    expect(r.effects).toEqual(["1 fikir projeye taşındı", "kaynak fikir çöp kutusunda"]);
    expect(seen).toEqual([`hand over ${top} to ${r.row.id}`]);
    expect(app.get("own_project", r.row.id).row.sectors.map((s: any) => s.path)).toEqual(["Sağlık"]);
    expect(h.sqlite.prepare("SELECT own_project_id FROM ideas WHERE id = ?").get(kid)).toEqual({ own_project_id: r.row.id });
    expect(events(h)).toEqual(["own_project.created"]);

    expect(() => app.projects.fromIdea(kid)).toThrow(/sadece en üstteki genel fikir projeye dönüşür/);
    expect(() => app.projects.fromIdea(999)).toThrow(/fikir #999 bulunamadı/);
    const sub = idea(h, "Başka alt", { parent_id: idea(h, "Başka üst") });
    expect(() => app.projects.fromIdea(sub)).toThrow(FFError);
  });
});
