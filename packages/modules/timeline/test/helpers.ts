import { createCore, createRegistry, defineModule, type Actor, type Clock, type DbHandle, type ModuleDef } from "@fullfollow/core";
import timeline from "../src";

/** Stand-in for the modules that write the events of the feed: one module lists their event types (the real ones list their own) */
export const feedKinds = defineModule({
  key: "writers",
  label: "W",
  contribute: {
    timelineKinds: {
      "touch.created": { kind: "temas", row: { key: "touch_id", table: "touches" } },
      "payment.paid": { kind: "odeme", amount: "amount" },
      "task.done": { kind: "gorev" },
      "opp.stage": { kind: "asama" },
      "draft.created": { kind: "taslak" },
    },
  },
});

/** Stand-in for the people module: the record type a person's timeline is asked for, by its Turkish alias and by name */
export const fakePeople = defineModule({
  key: "people",
  label: "P",
  entities: { person: { aliases: ["kişi"], ref: { table: "people", col: "name", label: "kişi" } } },
});

/** A core with the timeline module installed (and any stand-ins); the module API shorthand is `app.timeline` */
export function appFor(handle: DbHandle, actor: Actor, clock?: Clock, extra: ModuleDef[] = []) {
  const core = createCore(handle, actor, clock, createRegistry([timeline, ...extra]));
  return Object.assign(core, { timeline: core.mod("timeline")! });
}
export type TestApp = ReturnType<typeof appFor>;

const AT = "2026-10-14T10:00:00Z";

export interface EventSpec {
  type: string;
  at: string;
  by?: Actor;
  summary?: string;
  data?: unknown;
  person_id?: number | null;
  opportunity_id?: number | null;
  project_id?: number | null;
}

/** An event row written straight into the table */
export function event(handle: DbHandle, e: EventSpec): number {
  return Number(handle.sqlite.prepare("INSERT INTO events (type, person_id, opportunity_id, project_id, summary, data, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(e.type, e.person_id ?? null, e.opportunity_id ?? null, e.project_id ?? null, e.summary ?? e.type, e.data === undefined ? null : JSON.stringify(e.data), e.by ?? "ozgur", e.at).lastInsertRowid);
}

/** A bare person row (the people module is not installed here) */
export function person(handle: DbHandle, name = "Ada"): number {
  return Number(handle.sqlite.prepare("INSERT INTO people (name, created_at, updated_at, created_by) VALUES (?, ?, ?, 'ozgur')").run(name, AT, AT).lastInsertRowid);
}

/** A bare company row */
export function company(handle: DbHandle, name = "Acme"): number {
  return Number(handle.sqlite.prepare("INSERT INTO companies (name, created_at, updated_at, created_by) VALUES (?, ?, ?, 'ozgur')").run(name, AT, AT).lastInsertRowid);
}

/** A touch row about a company (the network module is not installed here) */
export function touch(handle: DbHandle, t: { company_id?: number; person_id?: number }): number {
  return Number(handle.sqlite.prepare(`INSERT INTO touches (person_id, company_id, channel, direction, kind, summary, happened_at, created_at, updated_at, created_by)
    VALUES (?, ?, 'email', 'giden', 'mesaj', 'x', ?, ?, ?, 'ozgur')`).run(t.person_id ?? null, t.company_id ?? null, AT, AT, AT).lastInsertRowid);
}
