import { beforeEach, describe, expect, it } from "vitest";
import { createCore, createRegistry, openDb, type Clock } from "@fullfollow/core";
import posts from "../src";

describe("Paylaşımlar", () => {
  // gün ilerleyebilen saat
  let day = "2026-10-09";
  const clock: Clock = { today: () => day, now: () => `${day}T10:00:00Z` };
  let ozgur: ReturnType<typeof createCore>;
  let claude: ReturnType<typeof createCore>;
  let sql: <T = any>(q: string, ...a: unknown[]) => T[];
  beforeEach(() => {
    day = "2026-10-09";
    const h = openDb(":memory:");
    ozgur = createCore(h, "ozgur", clock, createRegistry([posts]));
    claude = createCore(h, "claude", clock, createRegistry([posts]));
    sql = (q, ...a) => h.sqlite.prepare(q).all(...a) as any[];
  });

  const api = () => ozgur.mod("posts")!;

  it("14. paylaşım: yenileme hatırlatması, güncelledim düşürür, getirdiği kişi ve iş sayılır", () => {
    const post = api().create({ platform: "r10", title: "Web sitesi yapıyorum", url: "https://r10.net/x", posted_at: "2026-10-01", refresh_days: 7 }).row;
    api().create({ platform: "linkedin", title: "Tanıtım", posted_at: "2026-09-01" });
    expect(ozgur.today().posts_due.rows.map((p: any) => p.id)).toEqual([post.id]);
    const r = ozgur.save("post", { refreshed: true }, post.id);
    expect(r.effects.join(" ")).toContain("2026-10-16");
    expect(ozgur.today().posts_due.total).toBe(0);
    day = "2026-10-16";
    expect(ozgur.today().posts_due.total).toBe(1);

    // paylaşımdan gelen kişi ve kazanılan iş
    const src = ozgur.get("source", "R10").row;
    const p = claude.save("person", { name: "Forumdan Ali", post: "Web sitesi" }).row;
    expect(p.post_id).toBe(post.id);
    const o = ozgur.opportunities.create({ title: "Ali sitesi", person_id: p.id, source_id: src.id, estimated_value: 30000 }).row;
    ozgur.opportunities.create({ title: "Ali ikinci", person_id: p.id, source_id: src.id });
    ozgur.opportunities.move(o.id, { stage: "kazanildi" });
    const st = ozgur.find("post", { filter: { platform: "r10" } }).rows[0];
    expect(st).toMatchObject({ people_count: 1, opp_count: 2, won: 1, won_value: 30000 });
    expect(ozgur.personCard(p.id).post?.id).toBe(post.id);

    // paylaşım silinince kişi kalır, bağ kopar
    ozgur.remove("post", post.id);
    expect(sql("SELECT post_id FROM people WHERE id = ?", p.id)[0].post_id).toBeNull();
  });


  it("kayıt türü paylaşım olarak (aliaslarıyla) kaydedilir, çöp kutusundan geri gelir, fikirde posts ilişkisi listelenir", () => {
    const idea = ozgur.save("idea", { title: "Klinik botu" }).row;
    const p = ozgur.save("paylaşım", { platform: "linkedin", title: "Tanıtım", idea: "Klinik botu" }).row;
    expect(p.idea_id).toBe(idea.id);
    expect(ozgur.get("idea", idea.id, ["posts"]).related.posts.map((x: any) => x.id)).toEqual([p.id]);
    expect(ozgur.get("post", p.id, ["people"]).related.people).toEqual([]);
    expect(() => ozgur.save("post", { platform: "x", title: "bad" })).toThrow();
    ozgur.remove("post", p.id);
    expect(ozgur.find("trash").rows[0]).toMatchObject({ type: "post", what: "paylaşım" });
    ozgur.restore("post", "Tanıtım");
    expect(ozgur.find("post").total).toBe(1);
    expect(ozgur.moduleMeta().post_platforms).toEqual(["r10", "linkedin", "instagram", "diger"]);
  });

  it("modül yokken: Bugün'de posts_due yok, pazarlama raporunda paylaşım listeleri boş, kişi kartında paylaşım null", () => {
    const bare = createCore(openDb(":memory:"), "ozgur", clock);
    const person = bare.people.create({ name: "Ali" }).row;
    expect(bare.today()).not.toHaveProperty("posts_due");
    expect(bare.marketing()).toMatchObject({ posts: [], posts_due: [] });
    expect(bare.personCard(person.id).post).toBeNull();
    expect(() => bare.save("post", { title: "x" })).toThrow(/"post" türü için "posts" modülü kurulu değil/);
    expect(bare.save("person", { name: "Veli" }).row.name).toBe("Veli");
  });
});
