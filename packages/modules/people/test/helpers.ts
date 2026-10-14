import { createCore, createRegistry, type Actor, type Clock, type DbHandle, type ModuleDef } from "@fullfollow/core";
import people from "../src";

/** A core with the people module installed (and any extra probe modules); the module API shorthand is `app.people` */
export function appFor(handle: DbHandle, actor: Actor, clock?: Clock, extra: ModuleDef[] = []) {
  const core = createCore(handle, actor, clock, createRegistry([people, ...extra]));
  return Object.assign(core, { people: core.mod("people")! });
}
export type TestApp = ReturnType<typeof appFor>;
