import { announceTrashed, Bin, createCore, createRegistry, defineModule, type Actor, type Clock, type DbHandle, type ModuleDef } from "@fullfollow/core";
import network from "../src";

/** A core with the network module installed (and any extra probe modules); the module API shorthand is `app.network` */
export function appFor(handle: DbHandle, actor: Actor, clock?: Clock, extra: ModuleDef[] = []) {
  const core = createCore(handle, actor, clock, createRegistry([network, ...extra]));
  return Object.assign(core, { network: core.mod("network")! });
}
export type TestApp = ReturnType<typeof appFor>;

/**
 * Stand-in for the ideas module (this package imports only core): the idea record type with the handlers the generic dispatch needs,
 * the lookup the touch checks use, and the trash announcement a deleted idea makes.
 */
export const fakeIdeas = () => defineModule({
  key: "ideas",
  label: "I",
  api: (ctx) => ({ ref: (id: number) => ctx.sqlite.prepare("SELECT * FROM ideas WHERE id = ?").get(id) }),
  entities: {
    idea: {
      ref: { table: "ideas", col: "title", label: "fikir" },
      save: (ctx, d) => {
        const id = Number(ctx.sqlite.prepare("INSERT INTO ideas (title, created_at, updated_at, created_by) VALUES (?, ?, ?, ?)").run(d.title, ctx.clock.now(), ctx.clock.now(), ctx.actor).lastInsertRowid);
        return { row: ctx.sqlite.prepare("SELECT * FROM ideas WHERE id = ?").get(id), effects: [] };
      },
      get: (ctx, id) => ctx.sqlite.prepare("SELECT * FROM ideas WHERE id = ?").get(id) as Record<string, any> | undefined,
      delete: (ctx, id) => ctx.db.transaction((tx) => {
        const bin = new Bin(ctx);
        announceTrashed(ctx, bin, "idea", id);
        bin.take("ideas", "id = ?", id);
        bin.commit(tx, "idea", id, "fikir");
        return { effects: [] as string[], trash: { type: "idea", id } };
      }),
    },
  },
  contribute: { trashTypes: [{ type: "idea", label: "fikir" }] },
});
