import { eq } from "drizzle-orm";
import { actorName, assertOwner, emit, FFError, parse, row, rows, stamp, type Ctx } from "../context";
import { comments } from "../db/schema";
import { SUMMARY_PREVIEW_CHARS, type Actor, type CommentTarget } from "../constants";
import { m } from "../messages";
import { commentCreate, commentUpdate } from "../schemas";
import { requireRow, targetLabel, targetLink, targetTable, truncate } from "./shared";
import { Bin } from "./trash";

export interface Thread {
  id: number;                 // kök yorumun id'si
  target_type: CommentTarget;
  target_id: number;
  target_label: string;
  resolved_at: string | null;
  count: number;
  last_id: number;
  last_by: Actor;
  last_at: string;
  last_body: string;
  root_by: Actor;
  root_body: string;
  comments?: CommentRow[];
}

type StoredComment = typeof comments.$inferSelect;
type CommentRow = Omit<StoredComment, "options"> & { options: string[] | null };

/** The stored JSON list of quick answers as an array */
const withOptions = (c: StoredComment): CommentRow => ({ ...c, options: c.options ? JSON.parse(c.options) : null });

/** Konular: kök yorum + cevaplar. Son yorumu kullanıcı yazdıysa konu "cevapsız" (Claude'dan cevap bekliyor). */
export function threadOf(ctx: Ctx, root: StoredComment, withComments = false): Thread {
  const all = rows<StoredComment>(ctx, "SELECT * FROM comments WHERE id = ? OR parent_id = ? ORDER BY id", root.id, root.id).map(withOptions);
  const last = all[all.length - 1];
  return {
    id: root.id, target_type: root.target_type, target_id: root.target_id,
    target_label: targetLabel(ctx, root.target_type, root.target_id),
    resolved_at: root.resolved_at, count: all.length,
    last_id: last.id, last_by: last.created_by, last_at: last.created_at, last_body: last.body,
    root_by: all[0].created_by, root_body: all[0].body,
    ...(withComments ? { comments: all } : {}),
  };
}

export interface ThreadFilter {
  target_type?: CommentTarget;
  target_id?: number;
  /** son yorumu kullanıcı yazmış, açık konular */
  unanswered?: boolean;
  last_by?: Actor;
  /** true: sadece kapalı, false (varsayılan): sadece açık, "all": hepsi */
  resolved?: boolean | "all";
  /** true: her konunun tüm yorumları da gelir */
  messages?: boolean;
}

export function listThreads(ctx: Ctx, f: ThreadFilter = {}): Thread[] {
  const where = ["parent_id IS NULL"];
  const params: unknown[] = [];
  if (f.target_type) { where.push("target_type = ?"); params.push(f.target_type); }
  if (f.target_id) { where.push("target_id = ?"); params.push(f.target_id); }
  const roots = rows(ctx, `SELECT * FROM comments WHERE ${where.join(" AND ")} ORDER BY id`, ...params);
  let threads = roots.map((r) => threadOf(ctx, r, !!f.messages));
  const res = f.resolved ?? false;
  if (res !== "all") threads = threads.filter((t) => (res ? !!t.resolved_at : !t.resolved_at));
  const lastBy = f.unanswered ? "owner" : f.last_by;
  if (lastBy) threads = threads.filter((t) => t.last_by === lastBy);
  // cevap bekleyenler: en eskiden yeniye; diğerleri: en yeni önce
  return f.unanswered ? threads.sort((a, b) => a.last_id - b.last_id) : threads.sort((a, b) => b.last_id - a.last_id);
}

export function commentsService(ctx: Ctx) {
  const rootOf = (id: number) => {
    let c = requireRow(ctx, "comments", id);
    if (c.parent_id) c = requireRow(ctx, "comments", c.parent_id);
    return c;
  };

  /** Yeni konu (target_type + target_id) ya da cevap (reply_to). Kullanıcı ve Claude yazar; yazan giriş noktasından gelir. */
  function add(input: unknown) {
    const d = parse(commentCreate, input);
    return ctx.db.transaction((tx) => {
      let type: CommentTarget, targetId: number, parentId: number | null = null;
      const effects: string[] = [];
      if (d.reply_to) {
        const root = rootOf(d.reply_to);
        type = root.target_type; targetId = root.target_id; parentId = root.id;
        if (root.resolved_at) {
          tx.update(comments).set({ resolved_at: null, updated_at: ctx.clock.now() }).where(eq(comments.id, root.id)).run();
          emit(tx, ctx, {
            type: "comment.reopened", ...targetLink(ctx, type, targetId),
            summary: m.comments.threadReopened(targetLabel(ctx, type, targetId)),
          });
          effects.push(m.comments.reopenedEffect);
        }
      } else {
        if (!d.target_type || !d.target_id) throw new FFError("validation", m.comments.needsTarget);
        type = d.target_type; targetId = d.target_id;
        const table = targetTable(ctx, type);
        if (!table) throw new FFError("validation", m.comments.targetInvalid(type, ctx.types.commentTargets().join(", ")));
        requireRow(ctx, table, targetId);
      }
      if (d.options && ctx.actor !== "claude") throw new FFError("forbidden", m.comments.optionsClaudeOnly);
      const r = tx.insert(comments).values({
        target_type: type, target_id: targetId, body: d.body, parent_id: parentId,
        options: d.options ? JSON.stringify(d.options) : null, ...stamp(ctx),
      }).returning().get();
      emit(tx, ctx, {
        type: "comment.created", ...targetLink(ctx, type, targetId),
        summary: m.comments.written(actorName(ctx, ctx.actor), targetLabel(ctx, type, targetId), truncate(d.body, SUMMARY_PREVIEW_CHARS)),
        data: { comment_id: r.id, thread: parentId ?? r.id },
      });
      return { row: withOptions(r), effects };
    });
  }

  /** The owner opened the thread: Claude's comments in it are read now (no event: reading is not a change worth a timeline row) */
  function markRead(id: number) {
    assertOwner(ctx, m.comments.markReadAction);
    const root = rootOf(id);
    ctx.sqlite.prepare("UPDATE comments SET read_at = ? WHERE (id = ? OR parent_id = ?) AND created_by = 'claude' AND read_at IS NULL")
      .run(ctx.clock.now(), root.id, root.id);
    return { row: threadOf(ctx, root, true), effects: [] as string[] };
  }

  function resolve(id: number, resolved = true) {
    return ctx.db.transaction((tx) => {
      const root = rootOf(id);
      if (!!root.resolved_at === resolved) return { row: withOptions(root), effects: [] as string[] };
      tx.update(comments).set({ resolved_at: resolved ? ctx.clock.now() : null, updated_at: ctx.clock.now() }).where(eq(comments.id, root.id)).run();
      emit(tx, ctx, {
        type: resolved ? "comment.resolved" : "comment.reopened", ...targetLink(ctx, root.target_type, root.target_id),
        summary: (resolved ? m.comments.threadClosed : m.comments.threadReopened)(targetLabel(ctx, root.target_type, root.target_id)),
      });
      return { row: withOptions(requireRow(ctx, "comments", root.id)), effects: [] as string[] };
    });
  }

  /** Metni sadece yazarı değiştirebilir; resolved alanı konuyu kapatır/açar. Metin ve kapatma tek transaction'da: biri düşerse ikisi de geri alınır */
  function update(id: number, input: unknown) {
    const { body, resolved } = parse(commentUpdate, input);
    const cur = requireRow(ctx, "comments", id);
    return ctx.db.transaction((tx) => {
      if (body !== undefined) {
        if (cur.created_by !== ctx.actor) throw new FFError("forbidden", m.comments.authorOnlyEdit);
        tx.update(comments).set({ body, updated_at: ctx.clock.now() }).where(eq(comments.id, id)).run();
      }
      if (resolved !== undefined) resolve(id, resolved);
      return { row: withOptions(requireRow(ctx, "comments", id)), effects: [] as string[] };
    });
  }

  /**
   * Kök yorum silinirse cevapları da gider. Claude sadece kendi yorumunu silebilir
   * (kullanıcının sorusunu silip cevapsız listesinden düşüremez); kullanıcı her yorumu silebilir.
   * Başkasının cevabı olan bir kökü Claude silemez.
   */
  function remove(id: number) {
    const cur = requireRow(ctx, "comments", id);
    if (ctx.actor !== "owner") {
      const foreign = cur.created_by !== ctx.actor
        || (!cur.parent_id && row(ctx, "SELECT 1 x FROM comments WHERE parent_id = ? AND created_by != ?", id, ctx.actor));
      if (foreign) throw new FFError("forbidden", m.comments.claudeOnlyOwn);
    }
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      if (!cur.parent_id) bin.take("comments", "parent_id = ?", id);
      bin.take("comments", "id = ?", id);
      bin.commit(tx, "comment", id, m.comments.entry(truncate(cur.body, SUMMARY_PREVIEW_CHARS)));
      emit(tx, ctx, {
        type: "comment.deleted", ...targetLink(ctx, cur.target_type, cur.target_id),
        summary: m.comments.deleted(targetLabel(ctx, cur.target_type, cur.target_id), truncate(cur.body, SUMMARY_PREVIEW_CHARS)),
      });
      return { effects: [] as string[], trash: { type: "comment", id } };
    });
  }

  return { add, create: add, markRead, resolve, update, remove };
}
