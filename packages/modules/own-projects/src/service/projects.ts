import { eq } from "drizzle-orm";
import {
  announceTrashed, Bin, FFError, keptRow, label, OWN_PROJECT_STATUSES, parse, requireRow, schema, sectorInput, setSectorLinks, stamp, truncate, writeEvent as emit,
  type Ctx, type OwnProjectRecord,
} from "@fullfollow/core";
import { ownProjectCreate, ownProjectUpdate } from "./schemas";

const { own_projects, own_project_sectors } = schema;

/** The stored row of one own project */
export const ownProjectRef = (ctx: Ctx, id: number): OwnProjectRecord | undefined => keptRow<OwnProjectRecord>(ctx, "SELECT * FROM own_projects WHERE id = ?", id);

export function ownProjectsService(ctx: Ctx) {
  function create(input: unknown) {
    return ctx.db.transaction((tx) => {
      const { sector_ids, ...d } = parse(ownProjectCreate, sectorInput(tx, ctx, input));
      const r = tx.insert(own_projects).values({ ...d, ...stamp(ctx) }).returning().get();
      if (sector_ids?.length) setSectorLinks(tx, ctx, "own_project", r.id, sector_ids);
      emit(tx, ctx, { type: "own_project.created", summary: `Kendi projesi: ${truncate(d.name, 60)}`, data: { own_project_id: r.id } });
      return { row: r as OwnProjectRecord, effects: [] as string[] };
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
      return { row: requireRow<OwnProjectRecord>(ctx, "own_projects", id, "kendi projesi"), effects };
    });
  }

  function move(id: number, status: string) {
    if (!(OWN_PROJECT_STATUSES as readonly string[]).includes(status)) throw new FFError("validation", `proje durumu: ${OWN_PROJECT_STATUSES.join(", ")}`);
    return update(id, { status });
  }

  /** Its ideas fall back to the general list (the ideas module empties their link when it hears the announcement; restoring re-links them) */
  function remove(id: number) {
    const cur = requireRow(ctx, "own_projects", id, "kendi projesi");
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      announceTrashed(ctx, bin, "own_project", id);
      bin.take("own_project_sectors", "own_project_id = ?", id);
      bin.take("links", "target_type = 'own_project' AND target_id = ?", id);
      bin.take("comments", "target_type = 'own_project' AND target_id = ?", id);
      bin.take("own_projects", "id = ?", id);
      bin.commit(tx, "own_project", id, cur.name);
      emit(tx, ctx, { type: "own_project.deleted", summary: `Kendi projesi silindi: ${truncate(cur.name, 60)}` });
      return { effects: [] as string[], trash: { type: "own_project", id } };
    });
  }

  /** "Projeye dönüştür": a top level general idea becomes a project, its sub ideas become the project's ideas (the ideas module hands them over) */
  function fromIdea(ideaId: number) {
    const ideas = ctx.mod("ideas");
    if (!ideas) throw new FFError("validation", `fikirden proje için "ideas" modülü kurulu olmalı`);
    const idea = ideas.ref(ideaId);
    if (!idea) throw new FFError("not_found", `fikir #${ideaId} bulunamadı`);
    if (idea.own_project_id || idea.parent_id) throw new FFError("validation", "sadece en üstteki genel fikir projeye dönüşür");
    return ctx.db.transaction((tx) => {
      const now = ctx.clock.now();
      const p = tx.insert(own_projects).values({
        name: idea.title, description: idea.problem, notes: idea.notes, status: "aktif", sellable: "belki", ...stamp(ctx),
      }).returning().get();
      for (const sector_id of ideas.sectorIds(ideaId)) {
        tx.insert(own_project_sectors).values({ own_project_id: p.id, sector_id, created_at: now, created_by: ctx.actor }).run();
      }
      const kids = ideas.handOver(tx, ideaId, p.id);
      emit(tx, ctx, { type: "own_project.created", summary: `Fikirden proje: ${truncate(p.name, 60)}`, data: { own_project_id: p.id, idea_id: ideaId } });
      return { row: p as OwnProjectRecord, effects: [`${kids} fikir projeye taşındı`, "kaynak fikir çöp kutusunda"] };
    });
  }

  return { create, update, move, remove, fromIdea };
}
