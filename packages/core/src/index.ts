import type { Actor, RecordType } from "./constants";
import { FFError, systemClock, type Clock, type Ctx, type ListOpts } from "./context";
import type { DbHandle } from "./db/client";
import { commentsService } from "./services/comments";
import { companiesService, sourcesService } from "./services/companies";
import { draftsService } from "./services/drafts";
import { opportunitiesService } from "./services/opportunities";
import { paymentsService } from "./services/payments";
import { peopleService } from "./services/people";
import { projectsService } from "./services/projects";
import { queriesService } from "./services/queries";
import { normalizeType, resolveId } from "./services/records";
import { reportsService } from "./services/reports";
import { settingsService } from "./services/settings";
import { resolveInput, resolveRef } from "./services/shared";
import { tasksService } from "./services/tasks";
import { todayService } from "./services/today";
import { touchesService } from "./services/touches";

export * from "./constants";
export * from "./dates";
export { openDb, defaultDbPath, loadRootEnv, type DbHandle, type Db } from "./db/client";
export { FFError, systemClock, type Clock, type ListOpts, type ErrorCode } from "./context";
export { paymentStatus } from "./services/payments";
export { normalizeType } from "./services/records";
export type { Thread } from "./services/comments";

export interface SaveResult {
  row?: any;
  effects: string[];
}

/**
 * Çekirdek: web (NestJS, actor="ozgur") ve MCP (actor="claude") sadece buradan geçer.
 * `actor` giriş noktasından gelir; girdideki created_by asla kabul edilmez.
 */
export function createCore(handle: DbHandle, actor: Actor, clock: Clock = systemClock) {
  const ctx: Ctx = { db: handle.db, sqlite: handle.sqlite, actor, clock };

  const companies = companiesService(ctx);
  const people = peopleService(ctx);
  const sources = sourcesService(ctx);
  const opportunities = opportunitiesService(ctx);
  const touches = touchesService(ctx);
  const drafts = draftsService(ctx);
  const projects = projectsService(ctx);
  const payments = paymentsService(ctx);
  const tasks = tasksService(ctx);
  const comments = commentsService(ctx);
  const settings = settingsService(ctx);
  const queries = queriesService(ctx);
  const reports = reportsService(ctx);
  const todayFn = todayService(ctx);

  const empty = { effects: [] as string[] };

  /** Kayıt oluştur ya da güncelle (id verilirse güncelle). Aşama değişikliği burada yapılmaz. */
  function save(type: string, data: Record<string, any>, id?: string | number): SaveResult {
    const t = normalizeType(type);
    const d = resolveInput(ctx, data ?? {});
    const nid = id === undefined || id === null || id === "" ? undefined : resolveId(ctx, t, id);
    switch (t) {
      case "person": return nid ? people.update(nid, d) : people.create(d);
      case "company": return nid ? companies.update(nid, d) : companies.create(d);
      case "source": return nid ? sources.update(nid, d) : sources.create(d);
      case "opportunity": return nid ? opportunities.update(nid, d) : opportunities.create(d);
      case "project": return nid ? projects.update(nid, d) : projects.create(d);
      case "task": return nid ? tasks.update(nid, d) : tasks.create(d);
      case "payment": return nid ? payments.update(nid, d) : payments.create(d);
      case "draft": return nid ? drafts.update(nid, d) : drafts.create(d);
      case "touch":
        if (nid) throw new FFError("validation", "temas güncellenmez");
        return touches.create(d);
      case "comment": return nid ? comments.update(nid, d) : comments.add(d);
      case "setting": return settings.setMany(d);
    }
  }

  /** Fırsat ya da proje aşaması */
  function move(type: string, id: string | number, stage: string, reason?: string, position?: number): SaveResult {
    const t = normalizeType(type);
    const nid = resolveId(ctx, t, id);
    if (t === "opportunity") return opportunities.move(nid, { stage, reason, position });
    if (t === "project") return projects.move(nid, { stage });
    throw new FFError("validation", "move sadece opportunity ve project için");
  }

  function remove(type: string, id: string | number): SaveResult {
    const t = normalizeType(type);
    const nid = resolveId(ctx, t, id);
    switch (t) {
      case "person": return people.remove(nid);
      case "company": return companies.remove(nid);
      case "source": return sources.remove(nid);
      case "opportunity": return opportunities.remove(nid);
      case "project": return projects.remove(nid);
      case "task": return tasks.remove(nid);
      case "payment": return payments.remove(nid);
      case "draft": return drafts.remove(nid);
      case "touch": return touches.remove(nid);
      case "comment": return comments.remove(nid);
      case "setting": throw new FFError("validation", "ayar silinmez");
    }
    return empty;
  }

  const find = (type: string, o: ListOpts = {}) => queries.find(normalizeType(type), o);
  const get = (type: string, id: string | number, withRel: string[] = []) => {
    const t = normalizeType(type);
    return queries.get(t, resolveId(ctx, t, id), withRel);
  };
  const timeline = (type: string, id: string | number, limit = 20) => {
    const t = normalizeType(type);
    if (t !== "person" && t !== "opportunity" && t !== "project") throw new FFError("validation", "timeline için person, opportunity ya da project");
    return queries.timeline(t, resolveId(ctx, t, id), limit);
  };

  return {
    actor,
    // yazma servisleri (REST controller'ları ve testler kullanır)
    companies, people, sources, opportunities, touches, drafts, projects, payments, tasks, comments, settings,
    // okuma
    queries, reports, today: todayFn,
    // genel giriş (MCP araçları)
    find, get, save, move, remove, timeline,
    resolveRef: (type: "person" | "company" | "opportunity" | "project" | "source", ref: string | number) => resolveRef(ctx, type, ref),
  };
}

export type Core = ReturnType<typeof createCore>;
export type { RecordType };
