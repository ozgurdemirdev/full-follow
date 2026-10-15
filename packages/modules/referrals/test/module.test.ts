import { describe, expect, it } from "vitest";
import { defineModule, openDb, type Clock, type PersonPipelineStats, type PersonProjectStats, type ReferralNode } from "@fullfollow/core";
import { appFor } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };

/** Stand-ins for the people, pipeline and projects modules: this package imports nothing but core, so it is tested against their contracts */
const fakes = (tree: ReferralNode[], opps: [number, Partial<PersonPipelineStats>][] = [], work: [number, Partial<PersonProjectStats>][] = []) => [
  defineModule({ key: "people", label: "P", api: () => ({ referralTree: () => tree }) }),
  defineModule({ key: "pipeline", label: "O", api: () => ({ personStats: () => new Map(opps.map(([id, s]) => [id, { opps: 0, won: 0, lost: 0, won_value: 0, open_value: 0, ...s }])) }) }),
  defineModule({ key: "projects", label: "J", api: () => ({ personStats: () => new Map(work.map(([id, s]) => [id, { projects: 0, collected: 0, ...s }])) }) }),
];
const node = (id: number, name: string, referred_by_id: number | null = null): ReferralNode => ({ id, name, referred_by_id, company_name: null });

describe("referrals as a module", () => {
  it("walks the tree below each introducer: direct and whole network, opportunities, wins, projects and money; best first", () => {
    const tree = [node(1, "Tanıtan"), node(2, "B", 1), node(3, "C", 2), node(4, "D", 1)];
    const app = appFor(openDb(":memory:"), "ozgur", clock, fakes(
      tree,
      [[2, { opps: 2, won: 1, won_value: 40000 }], [3, { opps: 2, open_value: 5000 }]],
      [[2, { projects: 1, collected: 16000 }]],
    ));
    const report = app.referrals.report();
    expect(report.map((r) => r.person_id)).toEqual([1, 2]);
    expect(report[0]).toMatchObject({ person_id: 1, direct: 2, network: 3, opps: 4, won: 1, won_value: 40000, open_value: 5000, projects: 1, collected: 16000 });
    expect(report[1]).toMatchObject({ person_id: 2, direct: 1, network: 1, opps: 2, won: 0, open_value: 5000 });
    expect(app.referrals.of(2)).toEqual(report[1]);
    // nobody was introduced by 3 or 4
    expect(app.referrals.of(4)).toBeNull();
  });

  it("the screen's numbers and tree come from the server: introduced people against the rest, and the branches by weight", () => {
    const tree = [node(1, "Tanıtan"), node(2, "B", 1), node(3, "C", 2), node(4, "D", 1), node(5, "E")];
    const app = appFor(openDb(":memory:"), "ozgur", clock, fakes(
      tree,
      [[2, { opps: 2, won: 1, lost: 1, won_value: 40000 }], [3, { opps: 1, open_value: 5000 }], [4, { opps: 1, lost: 1 }], [5, { opps: 1, won: 1, won_value: 9000 }]],
    ));
    expect(app.referrals.kpis()).toEqual({
      referred: 3,
      referred_side: { won: 1, lost: 2, won_value: 40000, open_value: 5000 },
      other_side: { won: 1, lost: 0, won_value: 9000, open_value: 0 },
    });
    const root = app.referrals.tree(1)!;
    expect(root.person.name).toBe("Tanıtan");
    // B (with C below) brought more than D, so it comes first
    expect(root.kids.map((k) => k.person.id)).toEqual([2, 4]);
    expect(root.net).toEqual({ won: 40000, open: 5000, people: 3, wonCount: 1 });
    expect(root.kids[0]).toMatchObject({ own: { won: 40000, open: 0 }, net: { open: 5000, people: 1, wonCount: 0 } });
    expect(app.referrals.tree(99)).toBeNull();
  });

  it("a loop in the tree ends, and without the people, pipeline and projects modules the report is empty", () => {
    const loop = appFor(openDb(":memory:"), "ozgur", clock, fakes([node(1, "A", 2), node(2, "B", 1)]));
    expect(loop.referrals.report().map((r) => [r.person_id, r.network])).toEqual([[1, 1], [2, 1]]);
    const bare = appFor(openDb(":memory:"), "ozgur", clock);
    expect(bare.referrals.report()).toEqual([]);
    expect(bare.referrals.of(1)).toBeNull();
    expect(bare.referrals.suggestions()).toEqual({ thanks: [], asks: [] });
  });

  it("the money numbers are zero when only the tree is there", () => {
    const app = appFor(openDb(":memory:"), "ozgur", clock, [fakes([node(1, "A"), node(2, "B", 1)])[0]]);
    expect(app.referrals.report()).toEqual([{ person_id: 1, name: "A", company_name: null, direct: 1, network: 1, opps: 0, won: 0, won_value: 0, open_value: 0, projects: 0, collected: 0 }]);
  });
});
