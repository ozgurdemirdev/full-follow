import { beforeEach, expect, it, vi } from "vitest";
import { openDb, type Clock, type DbHandle } from "@fullfollow/core";
import { appFor, suite, type TestApp } from "./helpers";

let today = "2026-10-15";
let now = "2026-10-15T10:00:00Z";
const clock: Clock = { today: () => today, now: () => now };

suite("the fixes of the service review", () => {
  let h: DbHandle;
  let app: TestApp;
  const sql = (q: string, ...a: unknown[]) => h.sqlite.prepare(q).all(...a) as any[];
  beforeEach(() => {
    today = "2026-10-15";
    now = "2026-10-15T10:00:00Z";
    h = openDb(":memory:");
    app = appFor(h, "ozgur", clock);
  });

  it("the drafts list looks up the company names in one call, not one company at a time", () => {
    const a = app.companies.create({ name: "Acme" }).row;
    const b = app.companies.create({ name: "Beta" }).row;
    for (const company of [a, b]) {
      const p = app.people.create({ name: `K ${company.name}`, company_id: company.id }).row;
      app.drafts.create({ person_id: p.id, channel: "email", body: "x" });
    }
    const companies = app.mod("companies")!;
    const one = vi.spyOn(companies, "get");
    const names = vi.spyOn(companies, "names");
    expect(app.drafts.list({}).rows.map((d) => d.company_name).sort()).toEqual(["Acme", "Beta"]);
    expect(one).not.toHaveBeenCalled();
    expect(names).toHaveBeenCalledTimes(1);
    expect(companies.names([a.id, b.id, 9999])).toEqual(new Map([[a.id, "Acme"], [b.id, "Beta"]]));
  });
});
