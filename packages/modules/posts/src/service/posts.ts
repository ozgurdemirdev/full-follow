import { eq } from "drizzle-orm";
import { addDays, Bin, bool, has, page, parse, requireRow, rows, schema, stamp, truncate, writeEvent as emit, type Ctx, type ListOpts, type PostStats } from "@fullfollow/core";
import { PLATFORM_LABEL } from "./constants";
import { postCreate, postUpdate } from "./schemas";

const { posts } = schema;

/** Bir sonraki yenileme günü: son yenileme (yoksa paylaşım günü) + aralık */
export const nextRefresh = (p: { posted_at: string; refreshed_at: string | null; refresh_days: number | null }) =>
  p.refresh_days ? addDays((p.refreshed_at ?? p.posted_at).slice(0, 10), p.refresh_days) : null;

/**
 * Paylaşım listesi + getirdikleri: kişi (people.post_id), o kişilerin fırsatları, kazanılan ve tutar.
 * Yenileme zamanı gelen: aralık girilmiş ve son yenileme + aralık <= bugün.
 */
export function postStats(ctx: Ctx): PostStats[] {
  const today = ctx.clock.today();
  // TODO(modules): people, opportunities via ctx.mod("pipeline") and ideas via ctx.mod("ideas") (raw table reads for now)
  return rows(ctx, `
    SELECT p.*, i.title AS idea_title,
      (SELECT COUNT(*) FROM people x WHERE x.post_id = p.id) AS people_count,
      (SELECT COUNT(*) FROM opportunities o JOIN people x ON x.id = o.person_id WHERE x.post_id = p.id) AS opp_count,
      (SELECT COUNT(*) FROM opportunities o JOIN people x ON x.id = o.person_id WHERE x.post_id = p.id AND o.stage = 'kazanildi') AS won,
      (SELECT COALESCE(SUM(o.estimated_value), 0) FROM opportunities o JOIN people x ON x.id = o.person_id WHERE x.post_id = p.id AND o.stage = 'kazanildi') AS won_value
    FROM posts p LEFT JOIN ideas i ON i.id = p.idea_id
    ORDER BY p.posted_at DESC, p.id DESC`)
    .map((p) => {
      const next = nextRefresh(p);
      return { ...p, next_refresh_at: next, refresh_due: !!next && next <= today };
    });
}

export function postsService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(postCreate, input);
    return ctx.db.transaction((tx) => {
      // TODO(modules): via ctx.mod("ideas")
      if (d.idea_id) requireRow(ctx, "ideas", d.idea_id);
      const r = tx.insert(posts).values({ ...d, posted_at: d.posted_at ?? ctx.clock.today(), ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "post.created", summary: `Paylaşım (${PLATFORM_LABEL[d.platform]}): ${truncate(d.title, 60)}`, data: { post_id: r.id } });
      return { row: r, effects: [] as string[] };
    });
  }

  /** Alanları düzeltir; `refreshed: true` "güncelledim" demektir (yenileme bugüne alınır, hatırlatma düşer) */
  function update(id: number, input: unknown) {
    const { refreshed, ...d } = parse(postUpdate, input);
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "posts", id);
      if (d.idea_id) requireRow(ctx, "ideas", d.idea_id);
      const effects: string[] = [];
      const set: Record<string, unknown> = { ...d };
      if (refreshed) {
        set.refreshed_at = ctx.clock.today();
        const next = nextRefresh({ ...cur, ...d, refreshed_at: ctx.clock.today() });
        if (next) effects.push(`sonraki güncelleme ${next}`);
      }
      if (Object.keys(set).length) tx.update(posts).set({ ...set, updated_at: ctx.clock.now() }).where(eq(posts.id, id)).run();
      emit(tx, ctx, {
        type: refreshed ? "post.refreshed" : "post.updated",
        summary: `Paylaşım ${refreshed ? "güncellendi (yenilendi)" : "düzenlendi"}: ${truncate(d.title ?? cur.title, 60)}`,
        data: { post_id: id },
      });
      return { row: requireRow(ctx, "posts", id), effects };
    });
  }

  /** Kişiler kalır, sadece kaynak bağı kopar */
  function remove(id: number) {
    const cur = requireRow(ctx, "posts", id);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.unlink("people", "post_id", id);
      bin.take("comments", "target_type = 'post' AND target_id = ?", id);
      bin.take("posts", "id = ?", id);
      bin.commit(tx, "post", id, cur.title);
      emit(tx, ctx, { type: "post.deleted", summary: `Paylaşım silindi: ${truncate(cur.title, 60)}` });
      return { effects: [] as string[], trash: { type: "post", id } };
    });
  }

  /** Filters: platform, refresh_due, idea_id; q searches title, url, body and notes */
  function list(o: ListOpts): { rows: PostStats[]; total: number } {
    const f = o.filter ?? {};
    let items = postStats(ctx);
    if (f.platform) items = items.filter((x) => x.platform === f.platform);
    if (bool(f.refresh_due)) items = items.filter((x) => x.refresh_due);
    if (f.idea_id) items = items.filter((x) => x.idea_id === Number(f.idea_id));
    items = items.filter((x) => has(o.q, x.title, x.url, x.body, x.notes));
    return page(items, o.limit, o.offset);
  }

  return { create, update, remove, refresh: (id: number) => update(id, { refreshed: true }), list, stats: () => postStats(ctx), get: (id: number) => postStats(ctx).find((x) => x.id === id) };
}
