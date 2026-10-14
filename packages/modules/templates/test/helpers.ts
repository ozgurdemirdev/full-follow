import { contactKey, createCore, createRegistry, type Actor, type Clock, type DbHandle, type ModuleDef } from "@fullfollow/core";
import templates from "../src";

/** A core with the templates module installed (and any extra probe modules); the module API shorthand is `app.templates` */
export function appFor(handle: DbHandle, actor: Actor, clock?: Clock, extra: ModuleDef[] = []) {
  const core = createCore(handle, actor, clock, createRegistry([templates, ...extra]));
  return Object.assign(core, { templates: core.mod("templates")! });
}
export type TestApp = ReturnType<typeof appFor>;

const AT = "2026-10-14T10:00:00Z";

/** The people and companies modules are not installed here: bare rows are all a template needs */
export function person(handle: DbHandle, name: string, extra: { company?: string; sector?: number } = {}): number {
  const run = (sql: string, ...a: unknown[]) => Number(handle.sqlite.prepare(sql).run(...a).lastInsertRowid);
  const companyId = extra.company ? run("INSERT INTO companies (name, created_at, updated_at, created_by) VALUES (?, ?, ?, 'ozgur')", extra.company, AT, AT) : null;
  const id = run("INSERT INTO people (name, company_id, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, 'ozgur')", name, companyId, AT, AT);
  if (extra.sector) run("INSERT INTO person_sectors (person_id, sector_id, created_at, created_by) VALUES (?, ?, ?, 'ozgur')", id, extra.sector, AT);
  return id;
}

/** A draft that was sent to an address (a touch hangs on it), and optionally answered later */
export function sentDraft(handle: DbHandle, templateId: number, contact: string, answered: boolean): void {
  const run = (sql: string, ...a: unknown[]) => Number(handle.sqlite.prepare(sql).run(...a).lastInsertRowid);
  const draft = run("INSERT INTO drafts (contact, channel, body, status, template_id, created_at, updated_at, created_by) VALUES (?, 'email', 'x', 'gonderildi', ?, ?, ?, 'claude')", contact, templateId, AT, AT);
  const touch = (direction: string, at: string, draftId: number | null) => run(`INSERT INTO touches (contact, contact_key, channel, direction, kind, summary, happened_at, expects_reply, draft_id, created_at, updated_at, created_by)
    VALUES (?, ?, 'email', ?, 'mesaj', 'x', ?, ?, ?, ?, ?, 'ozgur')`, contact, contactKey(contact), direction, at, direction === "giden" ? 1 : 0, draftId, AT, AT);
  touch("giden", "2026-10-10T09:00:00Z", draft);
  if (answered) touch("gelen", "2026-10-11T09:00:00Z", null);
}
