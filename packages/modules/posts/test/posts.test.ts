import { beforeEach, describe, expect, it } from "vitest";
import { createCore, createRegistry, openDb, type Clock } from "@fullfollow/core";
import posts from "../src";

describe("Paylaşımlar", () => {
  const clock: Clock = { today: () => "2026-10-09", now: () => "2026-10-09T10:00:00Z" };
  let ozgur: ReturnType<typeof createCore>;
  beforeEach(() => {
    ozgur = createCore(openDb(":memory:"), "ozgur", clock, createRegistry([posts]));
  });

  const api = () => ozgur.mod("posts")!;

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

  it("modül yokken: Bugün'de posts_due yok, pazarlama raporunda paylaşım listeleri boş, tür kurulu değil hatası verir", () => {
    const bare = createCore(openDb(":memory:"), "ozgur", clock);
    expect(bare.today()).not.toHaveProperty("posts_due");
    expect(bare.marketing()).toMatchObject({ posts: [], posts_due: [] });
    expect(() => bare.save("post", { title: "x" })).toThrow(/"post" türü için "posts" modülü kurulu değil/);
  });
});
