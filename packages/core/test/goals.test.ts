import { beforeEach, describe, expect, it } from "vitest";
import { createCore, FFError, openDb, type Clock } from "../src";

describe("Günlük iş planı", () => {
  // 2026-10-09 is a Friday
  let day = "2026-10-09";
  const clock: Clock = { today: () => day, now: () => `${day}T10:00:00Z` };
  let ozgur: ReturnType<typeof createCore>;
  let claude: ReturnType<typeof createCore>;
  beforeEach(() => {
    day = "2026-10-09";
    const h = openDb(":memory:");
    ozgur = createCore(h, "ozgur", clock);
    claude = createCore(h, "claude", clock);
  });
  const mail = (to: string, at: string) => ozgur.touches.create({ contact: to, channel: "email", direction: "giden", summary: "cold mail", happened_at: at });

  it("hedef tekrar günlerine göre planda görünür, günler ön ayarla ya da listeyle verilir", () => {
    ozgur.goals.create({ title: "LinkedIn bağlantı isteği", target: 10, days: "hafta_ici" });
    claude.save("goal", { title: "Hafta sonu okuma", target: 1, days: [6, 7, 6] });
    expect(ozgur.goals.list().map((g) => g.days)).toEqual(["1,2,3,4,5", "6,7"]);
    expect(ozgur.goals.plan("2026-10-09").goals.map((g) => g.title)).toEqual(["LinkedIn bağlantı isteği"]);
    expect(ozgur.goals.plan("2026-10-10").goals.map((g) => g.title)).toEqual(["Hafta sonu okuma"]);
    expect(() => ozgur.goals.create({ title: "x", target: 0 })).toThrow(FFError);
  });

  it("kanallı hedef giden mesajları kendiliğinden sayar; elle +1 eklenir; geriye gün atlanmaz", () => {
    const g = claude.save("goal", { title: "Cold mail", target: 3, channel: "email" }).row;
    mail("a@x.com", "2026-10-09T09:00:00Z");
    mail("b@x.com", "2026-10-09T11:00:00Z");
    ozgur.touches.create({ contact: "@h", channel: "instagram", direction: "giden", summary: "dm", happened_at: "2026-10-09T09:00:00Z" });
    ozgur.touches.create({ contact: "c@x.com", channel: "email", direction: "gelen", summary: "cevap", happened_at: "2026-10-09T09:00:00Z" });
    mail("old@x.com", "2026-10-08T09:00:00Z");
    expect(ozgur.goals.plan().goals[0]).toMatchObject({ auto: 2, manual: 0, done: 2, complete: false });
    // elle ilerleme: add üstüne ekler, count belirler, eksiye inmez
    expect(claude.save("goal_log", { goal: "Cold mail", add: 1 }).effects).toEqual(["3/3 tamam"]);
    expect(ozgur.goals.log({ goal_id: g.id, add: -9 }).row.count).toBe(0);
    expect(ozgur.goals.log({ goal_id: g.id, count: 5 }).row.count).toBe(5);
    expect(() => ozgur.goals.log({ goal_id: g.id, add: 1, count: 2 })).toThrow(FFError);
    expect(() => ozgur.goals.log({ goal_id: g.id })).toThrow(FFError);
  });

  it("gün notu sayıyı bozmaz, hedefe kalıcı not ayrı durur", () => {
    const g = ozgur.goals.create({ title: "LinkedIn", target: 10, note: "kişiye özel not yaz" }).row;
    ozgur.goals.log({ goal_id: g.id, add: 4 });
    ozgur.goals.log({ goal_id: g.id, note: "fuar vardı, eksik kaldı" });
    expect(ozgur.goals.plan().goals[0]).toMatchObject({ manual: 4, note: "fuar vardı, eksik kaldı" });
    expect(ozgur.goals.list()[0].note).toBe("kişiye özel not yaz");
  });

  it("seri üst üste tamamlanan günleri sayar; bugünün eksiği seriyi bozmaz, dünün eksiği bozar", () => {
    day = "2026-10-05";
    const g = ozgur.goals.create({ title: "Mail", target: 2, days: "her_gun" }).row;
    for (const d of ["2026-10-05", "2026-10-06", "2026-10-07"]) ozgur.goals.log({ goal_id: g.id, date: d, count: 2 });
    day = "2026-10-08";
    expect(ozgur.goals.plan().streak).toBe(3);
    day = "2026-10-09";
    expect(ozgur.goals.plan().streak).toBe(0);
    ozgur.goals.log({ goal_id: g.id, date: "2026-10-08", count: 2 });
    ozgur.goals.log({ goal_id: g.id, count: 2 });
    expect(ozgur.goals.plan().streak).toBe(5);
  });

  it("haftalık oran pazartesiden bugüne min(yapılan, hedef) / hedef", () => {
    day = "2026-10-05";
    const g = ozgur.goals.create({ title: "Mail", target: 10, days: "hafta_ici" }).row;
    ozgur.goals.log({ goal_id: g.id, date: "2026-10-05", count: 10 });
    ozgur.goals.log({ goal_id: g.id, date: "2026-10-06", count: 30 });
    day = "2026-10-07";
    // pzt 10/10, sal 10/10 (fazlası sayılmaz), çar 0/10
    expect(ozgur.goals.plan().week_ratio).toBeCloseTo(20 / 30);
  });

  it("planda o günün görevleri ve geciken açık görevler görünür; takvim gün gün doluluk verir", () => {
    const g = ozgur.goals.create({ title: "Mail", target: 4, days: "her_gun" }).row;
    ozgur.tasks.create({ title: "bugünkü", due_date: "2026-10-09" });
    ozgur.tasks.create({ title: "geciken", due_date: "2026-10-07" });
    const done = ozgur.tasks.create({ title: "eski ama bitti", due_date: "2026-10-06" }).row;
    ozgur.tasks.update(done.id, { done: true });
    ozgur.tasks.create({ title: "yarın", due_date: "2026-10-10" });
    expect(ozgur.goals.plan().tasks.map((t: any) => t.title)).toEqual(["geciken", "bugünkü"]);
    expect(ozgur.goals.plan("2026-10-10").tasks.map((t: any) => t.title)).toEqual(["yarın"]);

    ozgur.goals.log({ goal_id: g.id, count: 2 });
    const cal = ozgur.goals.calendar("2026-10-08", "2026-10-10");
    expect(cal.map((c) => c.date)).toEqual(["2026-10-08", "2026-10-09", "2026-10-10"]);
    expect(cal[1]).toMatchObject({ ratio: 0.5 });
    expect(cal[1].tasks.map((t: any) => t.title)).toEqual(["bugünkü"]);
    expect(() => ozgur.goals.calendar("2026-01-01", "2026-12-31")).toThrow(FFError);
  });

  it("hedef silinince ilerlemesiyle çöp kutusuna gider ve geri gelir; today planı içerir", () => {
    const g = ozgur.goals.create({ title: "Mail", target: 2 }).row;
    ozgur.goals.log({ goal_id: g.id, count: 1 });
    expect(claude.today().plan.goals).toHaveLength(1);
    ozgur.remove("goal", g.id);
    expect(ozgur.goals.list()).toHaveLength(0);
    ozgur.restore("goal", "Mail");
    expect(ozgur.goals.plan().goals[0]).toMatchObject({ manual: 1 });
  });
});
