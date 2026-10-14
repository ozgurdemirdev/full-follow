import { createCore, createRegistry, type Actor, type Clock, type DbHandle, type ModuleDef } from "@fullfollow/core";
import pipeline from "../src";

/** A core with the pipeline module installed (and any extra probe modules); the module API shorthand is `app.pipeline` */
export function appFor(handle: DbHandle, actor: Actor, clock?: Clock, extra: ModuleDef[] = []) {
  const core = createCore(handle, actor, clock, createRegistry([pipeline, ...extra]));
  return Object.assign(core, { pipeline: core.mod("pipeline")! });
}
export type TestApp = ReturnType<typeof appFor>;

/** The people module is not installed here: a bare row is all an opportunity needs */
export function person(handle: DbHandle, name = "Ada", at = "2026-10-14T10:00:00Z"): number {
  return Number(handle.sqlite.prepare("INSERT INTO people (name, created_at, updated_at, created_by) VALUES (?, ?, ?, 'ozgur')").run(name, at, at).lastInsertRowid);
}
