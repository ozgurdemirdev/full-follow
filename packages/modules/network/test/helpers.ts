import { createCore, createRegistry, type Actor, type Clock, type DbHandle, type ModuleDef } from "@fullfollow/core";
import network from "../src";

/** A core with the network module installed (and any extra probe modules); the module API shorthand is `app.network` */
export function appFor(handle: DbHandle, actor: Actor, clock?: Clock, extra: ModuleDef[] = []) {
  const core = createCore(handle, actor, clock, createRegistry([network, ...extra]));
  return Object.assign(core, { network: core.mod("network")! });
}
export type TestApp = ReturnType<typeof appFor>;
