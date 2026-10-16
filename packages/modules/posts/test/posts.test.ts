import { beforeEach, describe, expect, it } from "vitest";
import { createCore, createRegistry, openDb, type Clock } from "@fullfollow/core";
import posts from "../src";
import { fakeIdeas } from "./helpers";

describe("Paylaşımlar", () => {
  const clock: Clock = { today: () => "2026-10-09", now: () => "2026-10-09T10:00:00Z" };
  let owner: ReturnType<typeof createCore>;
  beforeEach(() => {
    owner = createCore(openDb(":memory:"), "owner", clock, createRegistry([posts, fakeIdeas()]));
  });

  const api = () => owner.mod("posts")!;

  it("kayıt türü paylaşım olarak (aliaslarıyla) kaydedilir, çöp kutusundan geri gelir, fikirde posts ilişkisi listelenir", () => {
    const idea = owner.save("idea", { title: "Klinik botu" }).row;
    const p = owner.save("paylaşım", { platform: "linkedin", title: "Tanıtım", idea: "Klinik botu" }).row;
    expect(p.idea_id).toBe(idea.id);
    expect(owner.get("idea", idea.id, ["posts"]).related.posts.map((x: any) => x.id)).toEqual([p.id]);
    expect(owner.get("post", p.id, ["people"]).related.people).toEqual([]);
    expect(() => owner.save("post", { platform: "x", title: "bad" })).toThrow();
    owner.remove("post", p.id);
    expect(owner.find("trash").rows[0]).toMatchObject({ type: "post", what: "paylaşım" });
    owner.restore("post", "Tanıtım");
    expect(owner.find("post").total).toBe(1);
    expect(owner.moduleMeta().post_platforms).toEqual(["r10", "linkedin", "instagram", "diger"]);
  });

  it("a post without an interval of its own refreshes by the setting (default 30 days); its own interval wins; the format is one of four or empty", () => {
    const own = api().create({ platform: "r10", title: "Kendi aralığı", refresh_days: 7 }).row;
    const plain = api().create({ platform: "linkedin", title: "Aralıksız", format: "video" }).row;
    expect(plain.format).toBe("video");
    expect(api().get(own.id)).toMatchObject({ refresh_every: 7, next_refresh_at: "2026-10-16", refresh_due: false, format: null });
    expect(api().get(plain.id)).toMatchObject({ refresh_every: 30, next_refresh_at: "2026-11-08", refresh_due: false });
    owner.settings.set("post_refresh_days", 5);
    expect(api().get(plain.id)).toMatchObject({ refresh_every: 5, next_refresh_at: "2026-10-14" });
    expect(api().get(own.id)!.refresh_every).toBe(7);
    expect(api().update(plain.id, { refreshed: true }).effects).toEqual(["sonraki güncelleme 2026-10-14"]);
    expect(() => owner.settings.set("post_refresh_days", 0)).toThrow();
    expect(() => api().update(plain.id, { format: "podcast" })).toThrow(/format/);
    expect(api().update(plain.id, { format: null }).row.format).toBeNull();
  });

  it("modül yokken: Bugün'de posts_due yok, tür kurulu değil hatası verir", () => {
    const bare = createCore(openDb(":memory:"), "owner", clock);
    expect(bare.today()).not.toHaveProperty("posts_due");
    expect(bare.mod("posts")).toBeUndefined();
    expect(() => bare.save("post", { title: "x" })).toThrow(/"post" türü için "posts" modülü kurulu değil/);
  });
});
