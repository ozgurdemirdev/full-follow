import { createCore, createRegistry, type Actor, type Clock, type DbHandle, type ModuleDef } from "@fullfollow/core";
import companies from "../src";

/** A core with the companies module installed (and any extra probe modules); the module API shorthand is `app.companies` */
export function appFor(handle: DbHandle, actor: Actor, clock?: Clock, extra: ModuleDef[] = []) {
  const core = createCore(handle, actor, clock, createRegistry([companies, ...extra]));
  return Object.assign(core, { companies: core.mod("companies")! });
}
export type TestApp = ReturnType<typeof appFor>;
