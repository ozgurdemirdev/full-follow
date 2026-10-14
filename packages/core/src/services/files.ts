import { emit, parse, rows, stamp, type Ctx } from "../context";
import { files } from "../db/schema";
import { fileCreate } from "../schemas";
import { link, requireRow, requireTarget, truncate } from "./shared";
import { announceTrashed, Bin } from "./trash";

type FileRow = typeof files.$inferSelect;

/** Files of an opportunity or project, newest first */
export function filesOf(ctx: Ctx, targetType: "opportunity" | "project", targetId: number) {
  return rows<FileRow>(ctx, "SELECT * FROM files WHERE target_type = ? AND target_id = ? ORDER BY id DESC", targetType, targetId);
}

/**
 * File records only: the bytes live on disk and are written by the server (type check, size limit, stored name).
 * Removing a file puts its row in the trash; the bytes stay so it can come back.
 */
export function filesService(ctx: Ctx) {
  const owner = (r: Pick<FileRow, "target_type" | "target_id">) =>
    link(ctx, r.target_type === "opportunity" ? { opportunity_id: r.target_id } : { project_id: r.target_id });

  function create(input: unknown) {
    const d = parse(fileCreate, input);
    return ctx.db.transaction((tx) => {
      requireTarget(ctx, d.target_type, d.target_id);
      const r = tx.insert(files).values({ ...d, ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "file.uploaded", ...owner(d), summary: `Dosya eklendi: ${truncate(d.name, 60)}`, data: { file_id: r.id } });
      return { row: r, effects: [] as string[] };
    });
  }

  const get = (id: number) => requireRow<FileRow>(ctx, "files", id, "dosya");

  function remove(id: number) {
    const cur = get(id);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      // what points at the file (an offer's link to it) is emptied by the module that owns it
      announceTrashed(ctx, bin, "file", id);
      bin.take("files", "id = ?", id);
      bin.commit(tx, "file", id, `Dosya: ${truncate(cur.name, 60)}`);
      emit(tx, ctx, { type: "file.deleted", ...owner(cur), summary: `Dosya silindi: ${truncate(cur.name, 60)}` });
      return { effects: [] as string[], trash: { type: "file", id } };
    });
  }

  return { create, get, remove };
}
