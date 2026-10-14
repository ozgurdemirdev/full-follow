import { createCore, createRegistry, type Actor, type Clock, type DbHandle, type ModuleDef } from "@fullfollow/core";
import reports from "../src";

/** A core with the reports module installed (and any stand-ins for the modules it reads); the module API shorthand is `app.reports` */
export function appFor(handle: DbHandle, actor: Actor, clock?: Clock, extra: ModuleDef[] = []) {
  const core = createCore(handle, actor, clock, createRegistry([reports, ...extra]));
  return Object.assign(core, { reports: core.mod("reports")! });
}
export type TestApp = ReturnType<typeof appFor>;
