import { describe, expect, it } from "vitest";
import { FFError, openDb, type Clock } from "@fullfollow/core";
import { appFor } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };

describe("companies as a module", () => {
  it("companies go through the generic save, find, get and delete, by their Turkish aliases", () => {
    const app = appFor(openDb(":memory:"), "claude", clock);
    const c = app.save("firma", { name: "ABC Yazılım Ltd. Şti.", website: "https://www.abc.example", tags: ["Sıcak"], sectors: ["Kafe"] }).row;
    expect(app.get("company", c.id).row).toMatchObject({ name: "ABC Yazılım Ltd. Şti.", created_by: "claude", people_count: 0, tags: ["Sıcak"], sector_path: "Kafe" });
    expect(app.find("companies", { q: "abc" }).total).toBe(1);
    expect(app.find("firmalar", { filter: { tag: "sıcak" } }).total).toBe(1);
    expect(app.remove("company", c.id).trash).toEqual({ type: "company", id: c.id });
    expect(app.find("trash").rows[0]).toMatchObject({ type: "company", what: "firma" });
    app.restore("company", "ABC");
    expect(app.get("company", c.id).row.name).toBe("ABC Yazılım Ltd. Şti.");
  });

  it("the same name, domain or email is one company; a deleted one blocks a duplicate until it is restored", () => {
    const app = appFor(openDb(":memory:"), "owner", clock);
    const c = app.companies.create({ name: "ABC Yazılım Ltd.", website: "https://www.abc.example/hakkimizda", email: "info@abc.example" }).row;
    expect(() => app.companies.create({ name: "ABC Yazılım" })).toThrow(/firma adı zaten kayıtlı/);
    expect(() => app.companies.create({ name: "Başka", website: "abc.example" })).toThrow(/alan adı zaten kayıtlı/);
    app.remove("company", c.id);
    expect(() => app.companies.create({ name: "ABC Yazılım" })).toThrow(/çöp kutusunda/);
  });

  it("the card works without the people and network modules: no people, no touches, no channels", () => {
    const app = appFor(openDb(":memory:"), "owner", clock);
    const c = app.companies.create({ name: "ABC" }).row;
    expect(app.companies.card(c.id)).toMatchObject({ row: { name: "ABC" }, people: [], touches: { rows: [], total: 0 }, channels: [], opportunities: [], drafts: [], source: null });
    expect(() => app.get("company", c.id, ["people"])).toThrow(/geçerli ilişkiler/);
    expect(() => app.companies.card(999)).toThrow(FFError);
  });

  it("a person's company status moves forward through bumpStatus and never back; hand set statuses stay", () => {
    const app = appFor(openDb(":memory:"), "owner", clock);
    const c = app.companies.create({ name: "ABC" }).row;
    expect(app.companies.bumpStatus(c.id, "yazildi")).toEqual(["ABC: yazıldı"]);
    expect(app.companies.bumpStatus(c.id, "yazildi")).toEqual([]);
    expect(app.companies.bumpStatus(c.id, "gorusuldu")).toEqual(["ABC: görüşüldü"]);
    app.companies.update(c.id, { contact_status: "olumsuz" });
    expect(app.companies.bumpStatus(c.id, "gorusuldu")).toEqual([]);
    expect(app.companies.bumpStatus(999, "yazildi")).toEqual([]);
  });

  it("the city is saved and cleared; only the partner tag makes a partner (Ajans does not), and money reads zero without the projects and pipeline modules", () => {
    const app = appFor(openDb(":memory:"), "owner", clock);
    const abc = app.companies.create({ name: "ABC", city: "İzmir" }).row;
    expect(app.companies.get(abc.id)).toMatchObject({ city: "İzmir", segment: "lead", money: { won: 0, due: 0, open: 0 } });
    expect(app.companies.update(abc.id, { city: null }).row.city).toBeNull();
    const ortak = app.companies.create({ name: "Ortak", tags: ["İş ortağı"] }).row;
    const ajans = app.companies.create({ name: "Ajans X", tags: ["Ajans"] }).row;
    expect(app.companies.get(ortak.id)!.segment).toBe("partner");
    expect(app.companies.get(ajans.id)!.segment).toBe("lead");
  });

  it("comments hang on a company and read its name", () => {
    const app = appFor(openDb(":memory:"), "owner", clock);
    const c = app.companies.create({ name: "ABC" }).row;
    app.save("comment", { target_type: "company", target_id: c.id, body: "selam" });
    expect(app.find("comment").rows[0]).toMatchObject({ target_type: "company", target_label: "ABC" });
    expect(app.ctx.types.chatCard("company")!(app.ctx, c.id)).toEqual({ title: "ABC", status: "yazilmadi" });
  });
});
