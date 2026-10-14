import { createCore, createRegistry, defineModule, type Actor, type Clock, type DbHandle, type ModuleDef } from "@fullfollow/core";
import ideas from "../src";

/** A core with the ideas module installed (and any extra probe modules); the module API shorthand is `app.ideas` */
export function appFor(handle: DbHandle, actor: Actor, clock?: Clock, extra: ModuleDef[] = []) {
  const core = createCore(handle, actor, clock, createRegistry([ideas, ...extra]));
  return Object.assign(core, { ideas: core.mod("ideas")! });
}
export type TestApp = ReturnType<typeof appFor>;

const AT = "2026-10-14T10:00:00Z";
const run = (handle: DbHandle, sql: string, ...a: unknown[]) => Number(handle.sqlite.prepare(sql).run(...a).lastInsertRowid);

/** The people module is not installed here: a bare row is all an interest needs */
export function person(handle: DbHandle, name = "Ada"): number {
  return run(handle, "INSERT INTO people (name, created_at, updated_at, created_by) VALUES (?, ?, ?, 'ozgur')", name, AT, AT);
}

/** An own project row written by hand (the own-projects module is not installed here) */
export function project(handle: DbHandle, name = "Full Follow"): number {
  return run(handle, "INSERT INTO own_projects (name, created_at, updated_at, created_by) VALUES (?, ?, ?, 'ozgur')", name, AT, AT);
}

/** A touch row written by hand (the network module is not installed here) */
export function touch(handle: DbHandle, personId: number): number {
  return run(handle, `INSERT INTO touches (person_id, channel, direction, kind, summary, happened_at, created_at, updated_at, created_by)
    VALUES (?, 'email', 'giden', 'mesaj', 'x', ?, ?, ?, 'ozgur')`, personId, AT, AT, AT);
}

/** Stand-in for the own-projects module: the record type (by name) and the lookup the idea checks use */
export const fakeProjects = () => defineModule({
  key: "own-projects",
  label: "P",
  api: (ctx) => ({ ref: (id: number) => ctx.sqlite.prepare("SELECT * FROM own_projects WHERE id = ?").get(id) }),
  entities: {
    own_project: {
      ref: { table: "own_projects", col: "name", label: "kendi projesi" },
      related: ["links", "comments"],
      get: (ctx, id) => ctx.sqlite.prepare("SELECT * FROM own_projects WHERE id = ?").get(id) as Record<string, any> | undefined,
    },
  },
});

/** Stand-in for the people module: the record type by name */
export const fakePeople = () => defineModule({
  key: "people",
  label: "K",
  entities: { person: { ref: { table: "people", col: "name", label: "kişi" } } },
});
