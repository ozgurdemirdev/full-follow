import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Clock } from "@fullfollow/core";
import { appFor, suite, type TestApp } from "./helpers";

suite("Paylaşımlar ve kişiler", () => {
  // gün ilerleyebilen saat
  let day = "2026-10-09";
  const clock: Clock = { today: () => day, now: () => `${day}T10:00:00Z` };
  let owner: TestApp;
  let claude: TestApp;
  let sql: <T = any>(q: string, ...a: unknown[]) => T[];
  beforeEach(() => {
    day = "2026-10-09";
    const h = openDb(":memory:");
    owner = appFor(h, "owner", clock);
    claude = appFor(h, "claude", clock);
    sql = (q, ...a) => h.sqlite.prepare(q).all(...a) as any[];
  });

  it("14. paylaşım: yenileme hatırlatması, güncelledim düşürür, getirdiği kişi ve iş sayılır", () => {
    const post = owner.mod("posts")!.create({ platform: "r10", title: "Web sitesi yapıyorum", url: "https://r10.net/x", posted_at: "2026-10-01", refresh_days: 7 }).row;
    // without an interval of its own a post follows the post_refresh_days setting (30 days): posted on the 5th it is not due yet
    owner.mod("posts")!.create({ platform: "linkedin", title: "Tanıtım", posted_at: "2026-10-05" });
    expect(owner.today().posts_due.rows.map((p: any) => p.id)).toEqual([post.id]);
    const r = owner.save("post", { refreshed: true }, post.id);
    expect(r.effects.join(" ")).toContain("2026-10-16");
    expect(owner.today().posts_due.total).toBe(0);
    day = "2026-10-16";
    expect(owner.today().posts_due.total).toBe(1);

    // paylaşımdan gelen kişi ve kazanılan iş
    const src = owner.get("source", "R10").row;
    const p = claude.save("person", { name: "Forumdan Ali", post: "Web sitesi" }).row;
    expect(p.post_id).toBe(post.id);
    const o = owner.opportunities.create({ title: "Ali sitesi", person_id: p.id, source_id: src.id, estimated_value: 30000 }).row;
    owner.opportunities.create({ title: "Ali ikinci", person_id: p.id, source_id: src.id });
    owner.opportunities.move(o.id, { stage: "kazanildi" });
    const st = owner.find("post", { filter: { platform: "r10" } }).rows[0];
    expect(st).toMatchObject({ people_count: 1, opp_count: 2, won: 1, won_value: 30000 });
    expect(owner.personCard(p.id).post?.id).toBe(post.id);

    // paylaşım silinince kişi kalır, bağ kopar
    owner.remove("post", post.id);
    expect(sql("SELECT post_id FROM people WHERE id = ?", p.id)[0].post_id).toBeNull();
  });
});
