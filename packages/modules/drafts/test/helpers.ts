import { contactKey, createCore, createRegistry, type Actor, type Clock, type DbHandle, type ModuleDef } from "@fullfollow/core";
import drafts from "../src";

/** A core with the drafts module installed (and any extra probe modules); the module API shorthand is `app.drafts` */
export function appFor(handle: DbHandle, actor: Actor, clock?: Clock, extra: ModuleDef[] = []) {
  const core = createCore(handle, actor, clock, createRegistry([drafts, ...extra]));
  return Object.assign(core, { drafts: core.mod("drafts")! });
}
export type TestApp = ReturnType<typeof appFor>;

const AT = "2026-10-14T10:00:00Z";

/** The people module is not installed here: a bare row is all a draft needs */
export function person(handle: DbHandle, name = "Ada", extra: { next_follow_up_at?: string; email?: string } = {}): number {
  return Number(handle.sqlite.prepare("INSERT INTO people (name, email, next_follow_up_at, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, 'ozgur')")
    .run(name, extra.email ?? null, extra.next_follow_up_at ?? null, AT, AT).lastInsertRowid);
}

/** A touch row written straight into the table (the network module is not installed here) */
export function touch(handle: DbHandle, t: { person_id?: number; contact?: string; channel?: string; direction?: string; kind?: string; at: string; expects_reply?: boolean }): number {
  return Number(handle.sqlite.prepare(`INSERT INTO touches (person_id, contact, contact_key, channel, direction, kind, summary, happened_at, expects_reply, created_at, updated_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'x', ?, ?, ?, ?, 'ozgur')`)
    .run(t.person_id ?? null, t.contact ?? null, t.contact ? contactKey(t.contact) : null, t.channel ?? "email", t.direction ?? "giden", t.kind ?? "mesaj", t.at,
      (t.expects_reply ?? (t.direction ?? "giden") === "giden") ? 1 : 0, AT, AT).lastInsertRowid);
}
