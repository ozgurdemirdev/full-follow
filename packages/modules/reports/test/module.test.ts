import { describe, expect, it } from "vitest";
import { createCore, defineModule, FFError, openDb, type Clock } from "@fullfollow/core";
import { appFor } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };

/** Stand-in for the projects module: what was collected in a month and what is still due in it */
const fakeProjects = defineModule({
  key: "projects",
  label: "P",
  api: () => ({ collectedIn: (ym: string) => (ym === "2026-10" ? 40000 : ym === "2026-09" ? 25000 : 0), outstandingDue: (ym: string) => (ym === "2026-10" ? 5000 : 0) }),
});

describe("reports as a module", () => {
  it("the price floor is (fixed costs + target net) / (1 - tax rate) and rides along with the settings view", () => {
    const app = appFor(openDb(":memory:"), "ozgur", clock);
    app.settings.setMany({ bagkur_monthly: 5000, accounting_monthly: 1000, other_fixed_monthly: 0, target_net_monthly: 24000 });
    expect(app.reports.priceFloor()).toMatchObject({ subtotal: 30000, floor: 30000 });
    app.settings.setMany({ tax_rate_percent: 25 });
    expect(app.reports.priceFloor().floor).toBe(40000);
    expect(app.settings.view()).toMatchObject({ bagkur_monthly: 5000, subtotal: 30000, floor: 40000 });
    // the floor belongs to this module: a core without it shows the settings only
    const bare = createCore(openDb(":memory:"), "ozgur", clock);
    expect(bare.settings.view()).not.toHaveProperty("floor");
  });

  it("the month report sets what was collected against the floor, and the chart series runs oldest to newest", () => {
    const app = appFor(openDb(":memory:"), "ozgur", clock, [fakeProjects]);
    app.settings.setMany({ target_net_monthly: 30000 });
    expect(app.reports.month("2026-10")).toMatchObject({ month: "2026-10", collected: 40000, outstanding_due: 5000, floor: 30000, gap: 10000 });
    expect(app.reports.month()).toMatchObject({ month: "2026-10" });
    expect(app.reports.months(3).map((m) => [m.month, m.collected])).toEqual([["2026-08", 0], ["2026-09", 25000], ["2026-10", 40000]]);
    expect(app.reports.months(2, "2026-01").map((m) => m.month)).toEqual(["2025-12", "2026-01"]);
    expect(app.reports.report("2026-09")).toMatchObject({ sources: [], month: { collected: 25000 } });
  });

  it("the month insight: this month looks ahead at the due payments, a past month looks back at the floor and what was lost, a coming month and no floor say nothing", () => {
    const fakePipeline = defineModule({ key: "pipeline", label: "P", api: () => ({ lostIn: (ym: string) => (ym === "2026-09" ? { count: 2, budget: 36000 } : { count: 0, budget: 0 }) }) });
    const app = appFor(openDb(":memory:"), "ozgur", clock, [fakeProjects, fakePipeline]);
    const insight = (target: number, ym: string) => {
      app.settings.setMany({ target_net_monthly: target });
      return app.reports.month(ym).insight;
    };
    expect(insight(0, "2026-10")).toBeNull();
    expect(insight(30000, "2026-10")).toMatch(/^Bu ay taban kapandı/);
    // 3.000 short, 5.000 due: the floor is reached with 2.000 to spare
    expect(insight(43000, "2026-10")).toBe("Beklenen ₺5.000 ödeme gelirse taban kapanır ve ₺2.000 artı kalır.");
    // 2.000 short even with all due, within a tenth of the floor
    expect(insight(47000, "2026-10")).toBe("Beklenen ₺5.000 ödeme gelirse tabana yalnızca ₺2.000 eksik kalır.");
    expect(insight(80000, "2026-10")).toBe("Beklenen ₺5.000 ödeme gelse bile tabana ₺35.000 eksik kalır.");
    expect(insight(30000, "2026-09")).toBe("Eylül tabanın altında kaldı. O ay 2 teklif kaybedilmişti, toplam bütçesi ₺36.000.");
    expect(insight(20000, "2026-09")).toBe("Eylül tabanın üstünde kapandı.");
    expect(insight(30000, "2026-08")).toBe("Ağustos tabanın altında kaldı.");
    expect(insight(30000, "2026-11")).toBeNull();
    expect(app.reports.month("2026-09").lost).toEqual({ count: 2, budget: 36000 });
    // without the pipeline module nothing is known about lost offers
    const bare = appFor(openDb(":memory:"), "ozgur", clock, [fakeProjects]);
    bare.settings.setMany({ target_net_monthly: 30000 });
    expect(bare.reports.month("2026-09")).toMatchObject({ lost: null, insight: "Eylül tabanın altında kaldı." });
  });

  it("without the other modules every part answers empty, never an error", () => {
    const app = appFor(openDb(":memory:"), "ozgur", clock);
    const month = app.reports.month("2026-10");
    expect(month).toMatchObject({ collected: 0, outstanding_due: 0 });
    expect(month.gap).toBe(month.collected - month.floor);
    expect(app.reports.bySource()).toEqual([]);
    expect(app.reports.sourceFunnel()).toBeUndefined();
    expect(app.reports.marketing()).toEqual({ posts: [], posts_due: [], ideas: [], template_groups: [], channels: [], followups: [] });
    const review = app.reports.review();
    expect(review).toMatchObject({ week: "2026-W42", start: "2026-10-12", end: "2026-10-18", current: true, next_week: null, next_monday: "2026-10-19", this_week: { sent: 0, offers: 0 } });
    expect(review.suggestions.length).toBeGreaterThanOrEqual(2);
    expect(review.suggestions.every((s) => s.key && s.text && s.task_title)).toBe(true);
  });

  it("the weekly review takes a week label or any date in it, and refuses anything else", () => {
    const app = appFor(openDb(":memory:"), "ozgur", clock);
    expect(app.reports.review("2026-W40")).toMatchObject({ week: "2026-W40", start: "2026-09-28", current: false, next_week: "2026-W41" });
    expect(app.reports.review("2026-10-07").week).toBe("2026-W41");
    expect(() => app.reports.review("bad")).toThrow(FFError);
  });

  it("the Today view carries the review of the current week, ready on Fridays; a core without the module has none", () => {
    const monday = appFor(openDb(":memory:"), "ozgur", clock);
    expect(monday.today().review).toEqual({ week: "2026-W42", ready: false });
    const friday = appFor(openDb(":memory:"), "ozgur", { today: () => "2026-10-16", now: () => "2026-10-16T10:00:00Z" });
    expect(friday.today().review).toEqual({ week: "2026-W42", ready: true });
    expect(createCore(openDb(":memory:"), "ozgur", clock).today()).not.toHaveProperty("review");
  });
});
