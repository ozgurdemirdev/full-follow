import { createCore, createRegistry, defineModule, type Actor, type Clock, type DbHandle, type ModuleDef } from "@fullfollow/core";
import ownProjects from "../src";

/** A core with the own-projects module installed (and any extra probe modules); the module API shorthand is `app.projects` */
export function appFor(handle: DbHandle, actor: Actor, clock?: Clock, extra: ModuleDef[] = []) {
  const core = createCore(handle, actor, clock, createRegistry([ownProjects, ...extra]));
  return Object.assign(core, { projects: core.mod("own-projects")! });
}
export type TestApp = ReturnType<typeof appFor>;

const AT = "2026-10-14T10:00:00Z";

/** An idea row written by hand (the ideas module is not installed here) */
export function idea(handle: DbHandle, title: string, extra: { own_project_id?: number; parent_id?: number; done?: boolean; problem?: string } = {}): number {
  return Number(handle.sqlite.prepare("INSERT INTO ideas (title, problem, parent_id, own_project_id, done_at, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'ozgur')")
    .run(title, extra.problem ?? null, extra.parent_id ?? null, extra.own_project_id ?? null, extra.done ? AT : null, AT, AT).lastInsertRowid);
}

/**
 * Stand-in for the ideas module (this package imports only core): the idea record type by name, the lookups an own project needs
 * and the hand over, which moves the sub ideas and trashes the idea the way the module does.
 */
export const fakeIdeas = (seen: string[] = []) => defineModule({
  key: "ideas",
  label: "I",
  api: (ctx) => ({
    ref: (id: number) => ctx.sqlite.prepare("SELECT * FROM ideas WHERE id = ?").get(id),
    sectorIds: (id: number) => (ctx.sqlite.prepare("SELECT sector_id FROM idea_sectors WHERE idea_id = ?").all(id) as { sector_id: number }[]).map((r) => r.sector_id),
    handOver: (_q: unknown, ideaId: number, projectId: number) => {
      seen.push(`hand over ${ideaId} to ${projectId}`);
      const kids = ctx.sqlite.prepare("UPDATE ideas SET parent_id = NULL, own_project_id = ? WHERE parent_id = ?").run(projectId, ideaId).changes;
      ctx.sqlite.prepare("DELETE FROM idea_sectors WHERE idea_id = ?").run(ideaId);
      ctx.sqlite.prepare("DELETE FROM ideas WHERE id = ?").run(ideaId);
      return kids;
    },
  }),
  entities: { idea: { ref: { table: "ideas", col: "title", label: "fikir" } } },
});
