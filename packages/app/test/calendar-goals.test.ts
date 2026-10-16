import { beforeEach, describe, expect, it } from "vitest";
import { FFError, openDb, type Clock } from "@fullfollow/core";
import { appFor, suite, type TestApp } from "./helpers";

suite("Günlük iş planı", () => {
  // 2026-10-09 is a Friday
  let day = "2026-10-09";
  const clock: Clock = { today: () => day, now: () => `${day}T10:00:00Z` };
  let owner: TestApp;
  let claude: TestApp;
  beforeEach(() => {
    day = "2026-10-09";
    const h = openDb(":memory:");
    owner = appFor(h, "owner", clock);
    claude = appFor(h, "claude", clock);
  });
  const mail = (to: string, at: string) => owner.touches.create({ contact: to, channel: "email", direction: "giden", summary: "cold mail", happened_at: at });

  it("hedef tekrar günlerine göre planda görünür, günler ön ayarla ya da listeyle verilir", () => {
    owner.goals.create({ title: "LinkedIn bağlantı isteği", target: 10, days: "hafta_ici" });
    claude.save("goal", { title: "Hafta sonu okuma", target: 1, days: [6, 7, 6] });
    expect(owner.goals.list().map((g) => g.days)).toEqual(["1,2,3,4,5", "6,7"]);
    expect(owner.goals.plan("2026-10-09").goals.map((g) => g.title)).toEqual(["LinkedIn bağlantı isteği"]);
    expect(owner.goals.plan("2026-10-10").goals.map((g) => g.title)).toEqual(["Hafta sonu okuma"]);
    expect(() => owner.goals.create({ title: "x", target: 0 })).toThrow(FFError);
  });

  it("kanallı hedef giden mesajları kendiliğinden sayar; elle +1 eklenir; geriye gün atlanmaz", () => {
    const g = claude.save("goal", { title: "Cold mail", target: 3, channel: "email" }).row;
    mail("a@x.com", "2026-10-09T09:00:00Z");
    mail("b@x.com", "2026-10-09T11:00:00Z");
    owner.touches.create({ contact: "@h", channel: "instagram", direction: "giden", summary: "dm", happened_at: "2026-10-09T09:00:00Z" });
    owner.touches.create({ contact: "c@x.com", channel: "email", direction: "gelen", summary: "cevap", happened_at: "2026-10-09T09:00:00Z" });
    mail("old@x.com", "2026-10-08T09:00:00Z");
    expect(owner.goals.plan().goals[0]).toMatchObject({ auto: 2, manual: 0, done: 2, complete: false });
    // elle ilerleme: add üstüne ekler, count belirler, eksiye inmez
    expect(claude.save("goal_log", { goal: "Cold mail", add: 1 }).effects).toEqual(["3/3 tamam"]);
    expect(owner.goals.log({ goal_id: g.id, add: -9 }).row.count).toBe(0);
    expect(owner.goals.log({ goal_id: g.id, count: 5 }).row.count).toBe(5);
    expect(() => owner.goals.log({ goal_id: g.id, add: 1, count: 2 })).toThrow(FFError);
    expect(() => owner.goals.log({ goal_id: g.id })).toThrow(FFError);
  });

  it("gün notu sayıyı bozmaz, hedefe kalıcı not ayrı durur", () => {
    const g = owner.goals.create({ title: "LinkedIn", target: 10, note: "kişiye özel not yaz" }).row;
    owner.goals.log({ goal_id: g.id, add: 4 });
    owner.goals.log({ goal_id: g.id, note: "fuar vardı, eksik kaldı" });
    expect(owner.goals.plan().goals[0]).toMatchObject({ manual: 4, note: "fuar vardı, eksik kaldı" });
    expect(owner.goals.list()[0].note).toBe("kişiye özel not yaz");
  });

  it("seri üst üste tamamlanan günleri sayar; bugünün eksiği seriyi bozmaz, dünün eksiği bozar", () => {
    day = "2026-10-05";
    const g = owner.goals.create({ title: "Mail", target: 2, days: "her_gun" }).row;
    for (const d of ["2026-10-05", "2026-10-06", "2026-10-07"]) owner.goals.log({ goal_id: g.id, date: d, count: 2 });
    day = "2026-10-08";
    expect(owner.goals.plan().streak).toBe(3);
    day = "2026-10-09";
    expect(owner.goals.plan().streak).toBe(0);
    owner.goals.log({ goal_id: g.id, date: "2026-10-08", count: 2 });
    owner.goals.log({ goal_id: g.id, count: 2 });
    expect(owner.goals.plan().streak).toBe(5);
  });

  it("haftalık oran pazartesiden bugüne min(yapılan, hedef) / hedef", () => {
    day = "2026-10-05";
    const g = owner.goals.create({ title: "Mail", target: 10, days: "hafta_ici" }).row;
    owner.goals.log({ goal_id: g.id, date: "2026-10-05", count: 10 });
    owner.goals.log({ goal_id: g.id, date: "2026-10-06", count: 30 });
    day = "2026-10-07";
    // pzt 10/10, sal 10/10 (fazlası sayılmaz), çar 0/10
    expect(owner.goals.plan().week_ratio).toBeCloseTo(20 / 30);
  });

  it("planda o günün görevleri ve geciken açık görevler görünür; takvim gün gün doluluk verir", () => {
    const g = owner.goals.create({ title: "Mail", target: 4, days: "her_gun" }).row;
    owner.tasks.create({ title: "bugünkü", due_date: "2026-10-09" });
    owner.tasks.create({ title: "geciken", due_date: "2026-10-07" });
    const done = owner.tasks.create({ title: "eski ama bitti", due_date: "2026-10-06" }).row;
    owner.tasks.update(done.id, { done: true });
    owner.tasks.create({ title: "yarın", due_date: "2026-10-10" });
    expect(owner.goals.plan().tasks.map((t: any) => t.title)).toEqual(["geciken", "bugünkü"]);
    expect(owner.goals.plan("2026-10-10").tasks.map((t: any) => t.title)).toEqual(["yarın"]);

    owner.goals.log({ goal_id: g.id, count: 2 });
    const cal = owner.goals.calendar("2026-10-08", "2026-10-10");
    expect(cal.map((c) => c.date)).toEqual(["2026-10-08", "2026-10-09", "2026-10-10"]);
    expect(cal[1]).toMatchObject({ ratio: 0.5 });
    expect(cal[1].tasks.map((t: any) => t.title)).toEqual(["bugünkü"]);
    expect(() => owner.goals.calendar("2026-01-01", "2026-12-31")).toThrow(FFError);
  });

  it("hedef silinince ilerlemesiyle çöp kutusuna gider ve geri gelir; today planı içerir", () => {
    const g = owner.goals.create({ title: "Mail", target: 2 }).row;
    owner.goals.log({ goal_id: g.id, count: 1 });
    expect(claude.today().plan.goals).toHaveLength(1);
    owner.remove("goal", g.id);
    expect(owner.goals.list()).toHaveLength(0);
    owner.restore("goal", "Mail");
    expect(owner.goals.plan().goals[0]).toMatchObject({ manual: 1 });
  });

  it("görev firmaya bağlanabilir, tek kayda bağlanır; firma silinince görev kalır", () => {
    const co = owner.companies.create({ name: "ABC" }).row;
    const t = claude.save("task", { title: "teklif", company: "ABC", due_date: "2026-10-12" }).row;
    expect(owner.find("task").rows[0]).toMatchObject({ company_id: co.id, company_name: "ABC" });
    expect(() => owner.tasks.create({ title: "x", company_id: co.id, person_id: 1 })).toThrow(FFError);
    owner.remove("company", co.id);
    expect(owner.find("task").rows[0]).toMatchObject({ id: t.id, company_id: null });
  });

  it("yeni kayıt hedefi o gün eklenen kişi ve firmaları sayar, silinenleri saymaz, atlanan mükerrerleri gösterir", () => {
    owner.goals.create({ title: "Liste yenileme", target: 3, metric: "new_records" });
    expect(() => owner.goals.create({ title: "x", target: 1, metric: "new_records", channel: "email" })).toThrow(FFError);
    const bulk = claude.saveMany("person", [{ name: "A", email: "a@x.com" }, { name: "A kopya", email: "a@x.com" }, { name: "C", email: "c@x.com" }]);
    expect(bulk.skipped).toHaveLength(1);
    owner.companies.create({ name: "ABC" });
    owner.remove("person", bulk.created[1].id);
    day = "2026-10-10";
    owner.people.create({ name: "Başka gün", email: "d@x.com" });
    day = "2026-10-09";
    expect(owner.goals.plan().goals[0]).toMatchObject({ metric: "new_records", auto: 2, duplicates: 1, done: 2, complete: false });
    expect(owner.goals.plan("2026-10-10").goals[0]).toMatchObject({ auto: 1, duplicates: 0 });
  });
});
