import { createCore, createRegistry, type Actor, type Clock, type DbHandle, type ModuleDef } from "@fullfollow/core";
import referrals from "../src";

/** A core with the referrals module installed (and any extra probe modules); the module API shorthand is `app.referrals` */
export function appFor(handle: DbHandle, actor: Actor, clock?: Clock, extra: ModuleDef[] = []) {
  const core = createCore(handle, actor, clock, createRegistry([referrals, ...extra]));
  return Object.assign(core, { referrals: core.mod("referrals")! });
}
export type TestApp = ReturnType<typeof appFor>;
