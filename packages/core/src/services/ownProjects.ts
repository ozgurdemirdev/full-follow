import { eq } from "drizzle-orm";
import { label, OWN_PROJECT_STATUSES } from "../constants";
import { emit, FFError, parse, row, rows, stamp, type Ctx } from "../context";
import { own_projects, own_project_sectors } from "../db/schema";
import { ownProjectCreate, ownProjectUpdate } from "../schemas";
import { trashIdea } from "./ideas";
import { sectorInput, setSectorLinks } from "./sectors";
import { requireRow, truncate } from "./shared";
import { Bin } from "./trash";

/** Own products list with open/done idea counts and sectors, grouped by status */
export function ownProjectStats(ctx: Ctx) {
  const secs = rows<{ own_project_id: number; id: number; path: string }>(ctx, `
    SELECT x.own_project_id, s.id, CASE WHEN p.name IS NULL THEN s.name ELSE p.name || ' > ' || s.name END AS path
    FROM own_project_sectors x JOIN sectors s ON s.id = x.sector_id LEFT JOIN sectors p ON p.id = s.parent_id ORDER BY path`);
  return rows(ctx, `
    SELECT o.*,
      (SELECT COUNT(*) FROM ideas i WHERE i.own_project_id = o.id AND i.done_at IS NULL) AS open_ideas,
      (SELECT COUNT(*) FROM ideas i WHERE i.own_project_id = o.id AND i.done_at IS NOT NULL) AS done_ideas
    FROM own_projects o`)
    .map((o) => ({ ...o, sectors: secs.filter((x) => x.own_project_id === o.id).map((x) => ({ id: x.id, path: x.path })) }))
    .sort((a, b) => OWN_PROJECT_STATUSES.indexOf(a.status) - OWN_PROJECT_STATUSES.indexOf(b.status) || b.updated_at.localeCompare(a.updated_at));
}

export function ownProjectsService(ctx: Ctx) {
  function create(input: unknown) {
    return ctx.db.transaction((tx) => {
      const { sector_ids, ...d } = parse(ownProjectCreate, sectorInput(tx, ctx, input));
      const r = tx.insert(own_projects).values({ ...d, ...stamp(ctx) }).returning().get();
      if (sector_ids?.length) setSectorLinks(tx, ctx, "own_project", r.id, sector_ids);
      emit(tx, ctx, { type: "own_project.created", summary: `Kendi projesi: ${truncate(d.name, 60)}`, data: { own_project_id: r.id } });
      return { row: r, effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    return ctx.db.transaction((tx) => {
      const { sector_ids, ...d } = parse(ownProjectUpdate, sectorInput(tx, ctx, input));
      const cur = requireRow(ctx, "own_projects", id, "kendi projesi");
      const effects: string[] = [];
      if (Object.keys(d).length) tx.update(own_projects).set({ ...d, updated_at: ctx.clock.now() }).where(eq(own_projects.id, id)).run();
      if (sector_ids) setSectorLinks(tx, ctx, "own_project", id, sector_ids);
      const name = truncate(d.name ?? cur.name, 50);
      if (d.status && d.status !== cur.status) {
        emit(tx, ctx, { type: "own_project.status", summary: `Proje ${label(cur.status)} → ${label(d.status)}: ${name}`, data: { own_project_id: id, from: cur.status, to: d.status } });
        effects.push(`proje → ${label(d.status)}`);
      } else if (Object.keys(d).length || sector_ids) {
        emit(tx, ctx, { type: "own_project.updated", summary: `Kendi projesi düzenlendi: ${name}`, data: { own_project_id: id } });
      }
      return { row: requireRow(ctx, "own_projects", id, "kendi projesi"), effects };
    });
  }

  function move(id: number, status: string) {
    if (!(OWN_PROJECT_STATUSES as readonly string[]).includes(status)) throw new FFError("validation", `proje durumu: ${OWN_PROJECT_STATUSES.join(", ")}`);
    return update(id, { status });
  }

  /** Its ideas fall back to the general list (restore re-links them) */
  function remove(id: number) {
    const cur = requireRow(ctx, "own_projects", id, "kendi projesi");
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.unlink("ideas", "own_project_id", id);
      bin.take("own_project_sectors", "own_project_id = ?", id);
      bin.take("links", "target_type = 'own_project' AND target_id = ?", id);
      bin.take("comments", "target_type = 'own_project' AND target_id = ?", id);
      bin.take("own_projects", "id = ?", id);
      bin.commit(tx, "own_project", id, cur.name);
      emit(tx, ctx, { type: "own_project.deleted", summary: `Kendi projesi silindi: ${truncate(cur.name, 60)}` });
      return { effects: [] as string[], trash: { type: "own_project", id } };
    });
  }

  /** "Projeye dönüştür": a top level general idea becomes a project, its sub ideas become the project's ideas */
  function fromIdea(ideaId: number) {
    const idea = requireRow(ctx, "ideas", ideaId);
    if (idea.own_project_id || idea.parent_id) throw new FFError("validation", "sadece en üstteki genel fikir projeye dönüşür");
    return ctx.db.transaction((tx) => {
      const now = ctx.clock.now();
      const p = tx.insert(own_projects).values({
        name: idea.title, description: idea.problem, notes: idea.notes, status: "aktif", sellable: "belki", ...stamp(ctx),
      }).returning().get();
      for (const s of rows<{ sector_id: number }>(ctx, "SELECT sector_id FROM idea_sectors WHERE idea_id = ?", ideaId)) {
        tx.insert(own_project_sectors).values({ own_project_id: p.id, sector_id: s.sector_id, created_at: now, created_by: ctx.actor }).run();
      }
      const kids = rows<{ id: number }>(ctx, "SELECT id FROM ideas WHERE parent_id = ? ORDER BY id", ideaId);
      kids.forEach((k, i) => ctx.sqlite.prepare("UPDATE ideas SET parent_id = NULL, own_project_id = ?, priority = 'orta', position = ?, updated_at = ? WHERE id = ?").run(p.id, i, now, k.id));
      trashIdea(tx, ctx, ideaId);
      emit(tx, ctx, { type: "own_project.created", summary: `Fikirden proje: ${truncate(p.name, 60)}`, data: { own_project_id: p.id, idea_id: ideaId } });
      return { row: p, effects: [`${kids.length} fikir projeye taşındı`, "kaynak fikir çöp kutusunda"] };
    });
  }

  return { create, update, move, remove, fromIdea };
}
