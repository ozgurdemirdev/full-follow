import { eq } from "drizzle-orm";
import { emit, parse, stamp, type Ctx } from "../context";
import { links } from "../db/schema";
import { linkCreate, linkUpdate } from "../schemas";
import { assertAttachTarget, requireRow, requireTarget, targetLink, truncate } from "./shared";
import { Bin } from "./trash";

/** Labelled links on the records whose module allows them (an opportunity, a project, an own project); a project also shows the links of the opportunity it came from. */
export function linksService(ctx: Ctx) {
  const owner = (r: { target_type: string; target_id: number }) => targetLink(ctx, r.target_type, r.target_id);

  function create(input: unknown) {
    const d = parse(linkCreate, input);
    assertAttachTarget(ctx, d.target_type, ctx.types.linkTargets());
    return ctx.db.transaction((tx) => {
      requireTarget(ctx, d.target_type, d.target_id);
      const r = tx.insert(links).values({ ...d, ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "link.created", ...owner(d), summary: `Link eklendi: ${d.label}`, data: { link_id: r.id } });
      return { row: r, effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    const d = parse(linkUpdate, input);
    requireRow(ctx, "links", id);
    if (Object.keys(d).length) ctx.db.update(links).set({ ...d, updated_at: ctx.clock.now() }).where(eq(links.id, id)).run();
    return { row: requireRow(ctx, "links", id), effects: [] as string[] };
  }

  function remove(id: number) {
    const cur = requireRow(ctx, "links", id);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.take("links", "id = ?", id);
      bin.commit(tx, "link", id, `Link: ${truncate(cur.label, 60)}`);
      emit(tx, ctx, { type: "link.deleted", ...owner(cur), summary: `Link silindi: ${cur.label}` });
      return { effects: [] as string[], trash: { type: "link", id } };
    });
  }

  return { create, update, remove };
}
