import type { Actor, RecordType } from "./constants";
import { FFError, norm, rows, systemClock, type Clock, type Ctx, type DuplicateHit, type ListOpts } from "./context";
import type { DbHandle } from "./db/client";
import { sourcesService, tagsService } from "./services/categories";
import { commentsService } from "./services/comments";
import { companiesService } from "./services/companies";
import { assertKeysFree } from "./services/dupes";
import { draftsService } from "./services/drafts";
import { opportunitiesService } from "./services/opportunities";
import { paymentsService } from "./services/payments";
import { peopleService } from "./services/people";
import { projectsService } from "./services/projects";
import { queriesService } from "./services/queries";
import { networkLists } from "./services/network";
import { linksService } from "./services/links";
import { goalsService } from "./services/goals";
import { notesService } from "./services/notes";
import { normalizeType, resolveId } from "./services/records";
import { sectorsService } from "./services/sectors";
import { reportsService } from "./services/reports";
import { settingsService } from "./services/settings";
import { resolveInput, resolveRef } from "./services/shared";
import { tasksService } from "./services/tasks";
import { todayService } from "./services/today";
import { touchesService } from "./services/touches";
import { postsService } from "./services/posts";
import { templatesService } from "./services/templates";
import { ideasService } from "./services/ideas";
import { followupsDue, generateFollowups } from "./services/followups";
import { marketingReport } from "./services/marketing";
import { isCategory, restoreFromTrash, trashList, TYPE_LABEL } from "./services/trash";
import { TRASH_TYPES } from "./constants";

export * from "./constants";
export * from "./dates";
export { openDb, defaultDbPath, loadRootEnv, backupDb, type DbHandle, type Db } from "./db/client";
export { FFError, systemClock, type Clock, type ListOpts, type ErrorCode, type DuplicateHit } from "./context";
export { paymentStatus } from "./services/payments";
export { normalizeType } from "./services/records";
export type { Thread } from "./services/comments";
export type { TrashItem } from "./services/trash";

export interface SaveResult {
  row?: any;
  effects: string[];
  /** silmede: geri almak için (Geri al bildirimi) */
  trash?: { type: string; id: number };
}

/** Toplu kayıt sonucu: eklenenler, mükerrer diye atlananlar, hata verenler (sıra numarasıyla) */
export interface BulkResult {
  created: { index: number; id: number; label: string; effects: string[] }[];
  skipped: { index: number; label: string; existing: DuplicateHit }[];
  failed: { index: number; label: string; error: string }[];
}

type TrashType = (typeof TRASH_TYPES)[number];
const isTrashType = (t: string): t is TrashType => (TRASH_TYPES as readonly string[]).includes(t);

/**
 * Çekirdek: web (NestJS, actor="ozgur") ve MCP (actor="claude") sadece buradan geçer.
 * `actor` giriş noktasından gelir; girdideki created_by asla kabul edilmez.
 */
export function createCore(handle: DbHandle, actor: Actor, clock: Clock = systemClock) {
  const ctx: Ctx = { db: handle.db, sqlite: handle.sqlite, actor, clock };

  const companies = companiesService(ctx);
  const people = peopleService(ctx);
  const sources = sourcesService(ctx);
  const tags = tagsService(ctx);
  const opportunities = opportunitiesService(ctx);
  const touches = touchesService(ctx);
  const drafts = draftsService(ctx);
  const projects = projectsService(ctx);
  const payments = paymentsService(ctx);
  const tasks = tasksService(ctx);
  const comments = commentsService(ctx);
  const sectors = sectorsService(ctx);
  const notes = notesService(ctx);
  const links = linksService(ctx);
  const goals = goalsService(ctx);
  const settings = settingsService(ctx);
  const queries = queriesService(ctx);
  const reports = reportsService(ctx);
  const todayFn = todayService(ctx);
  const posts = postsService(ctx);
  const templates = templatesService(ctx);
  const ideas = ideasService(ctx);

  /**
   * Kişinin firması adla verilip (`company: "ABC Ltd"`) bulunamazsa firma açılır: toplu listede firmalar ayrıca eklenmesin.
   * Firma çöp kutusundaysa mükerrer hatası döner.
   */
  function withCompany(t: RecordType, data: Record<string, any>): Record<string, any> {
    if (t !== "person" || typeof data.company !== "string" || !data.company.trim() || data.company_id !== undefined) return data;
    const { company, ...rest } = data;
    try {
      return { ...rest, company_id: resolveRef(ctx, "company", company) };
    } catch (e) {
      if (!(e instanceof FFError) || e.code !== "not_found") throw e;
      return { ...rest, company_id: companies.create({ name: company }).row.id };
    }
  }

  /** Kayıt oluştur ya da güncelle (id verilirse güncelle). Aşama değişikliği burada yapılmaz. */
  function save(type: string, data: Record<string, any>, id?: string | number): SaveResult {
    const t = normalizeType(type);
    const d = resolveInput(ctx, withCompany(t, data ?? {}));
    const nid = id === undefined || id === null || id === "" ? undefined : resolveId(ctx, t, id);
    switch (t) {
      case "person": return nid ? people.update(nid, d) : people.create(d);
      case "company": return nid ? companies.update(nid, d) : companies.create(d);
      case "source": return nid ? sources.update(nid, d) : sources.create(d);
      case "tag": return nid ? tags.update(nid, d) : tags.create(d);
      case "opportunity": return nid ? opportunities.update(nid, d) : opportunities.create(d);
      case "project": return nid ? projects.update(nid, d) : projects.create(d);
      case "task": return nid ? tasks.update(nid, d) : tasks.create(d);
      case "payment": return nid ? payments.update(nid, d) : payments.create(d);
      case "draft": return nid ? drafts.update(nid, d) : drafts.create(d);
      case "touch": return nid ? touches.update(nid, d) : touches.create(d);
      case "sector": return nid ? sectors.update(nid, d) : sectors.create(d);
      case "note": return nid ? notes.update(nid, d) : notes.create(d);
      case "link": return nid ? links.update(nid, d) : links.create(d);
      case "goal": return nid ? goals.update(nid, d) : goals.create(d);
      case "goal_log": return goals.log(nid ? { ...d, goal_id: nid } : d);
      case "comment": return nid ? comments.update(nid, d) : comments.add(d);
      case "setting": return settings.setMany(d);
      case "post": return nid ? posts.update(nid, d) : posts.create(d);
      case "template": return nid ? templates.update(nid, d) : templates.create(d);
      case "idea": return nid ? ideas.update(nid, d) : ideas.create(d);
      case "interest": return nid ? ideas.updateInterest(nid, d) : ideas.saveInterest(d);
      case "trash": throw new FFError("validation", "çöp kutusuna kayıt yazılmaz; geri yüklemek için restore");
    }
  }

  /**
   * Toplu ekleme (MCP'ye verilen listeler): her kayıt ayrı denenir, mükerrerler atlanır ve hangi kayıtla çakıştığı söylenir.
   * Tek transaction içinde çalışır (hızlı); hata veren kayıt sadece kendisini geri alır.
   */
  function saveMany(type: string, items: Record<string, any>[]): BulkResult {
    const out: BulkResult = { created: [], skipped: [], failed: [] };
    const labelOf = (d: Record<string, any>) => String(d?.name ?? d?.title ?? d?.email ?? d?.contact ?? d?.summary ?? "").slice(0, 60);
    ctx.sqlite.transaction(() => {
      items.forEach((item, index) => {
        try {
          const r = save(type, item);
          out.created.push({ index, id: r.row?.id, label: labelOf(item), effects: r.effects });
        } catch (e) {
          if (e instanceof FFError && e.code === "duplicate" && e.duplicate) out.skipped.push({ index, label: labelOf(item), existing: e.duplicate });
          else out.failed.push({ index, label: labelOf(item), error: e instanceof Error ? e.message : String(e) });
        }
      });
    })();
    return out;
  }

  /** Fırsat ya da proje aşaması */
  function move(type: string, id: string | number, stage: string, reason?: string, position?: number): SaveResult {
    const t = normalizeType(type);
    const nid = resolveId(ctx, t, id);
    if (t === "opportunity") return opportunities.move(nid, { stage, reason, position });
    if (t === "project") return projects.move(nid, { stage });
    if (t === "idea") return ideas.move(nid, stage);
    throw new FFError("validation", "move sadece opportunity, project ve idea için");
  }

  /** Silme: kayıt çöp kutusuna gider (restore ile geri gelir); etiket, sektör ve kaynak yerinde gizlenir */
  function remove(type: string, id: string | number): SaveResult {
    const t = normalizeType(type);
    const nid = resolveId(ctx, t, id);
    switch (t) {
      case "person": return people.remove(nid);
      case "company": return companies.remove(nid);
      case "source": return { ...sources.remove(nid), trash: { type: "source", id: nid } };
      case "tag": return { ...tags.remove(nid), trash: { type: "tag", id: nid } };
      case "sector": return { ...sectors.remove(nid), trash: { type: "sector", id: nid } };
      case "opportunity": return opportunities.remove(nid);
      case "project": return projects.remove(nid);
      case "task": return tasks.remove(nid);
      case "payment": return payments.remove(nid);
      case "draft": return drafts.remove(nid);
      case "touch": return touches.remove(nid);
      case "comment": return comments.remove(nid);
      case "note": return notes.remove(nid);
      case "link": return links.remove(nid);
      case "goal": return goals.remove(nid);
      case "goal_log": throw new FFError("validation", "ilerleme silinmez; count:0 ile sıfırla");
      case "post": return posts.remove(nid);
      case "template": return templates.remove(nid);
      case "idea": return ideas.remove(nid);
      case "interest": return ideas.removeInterest(nid);
      case "setting": throw new FFError("validation", "ayar silinmez");
      case "trash": throw new FFError("validation", "çöp kutusundan kalıcı silme yok");
    }
  }

  /**
   * Geri yükleme: silinen kayıt (id ya da çöp kutusundaki adıyla) ya da gizlenen etiket/sektör/kaynak.
   * Kişi ve firmada mükerrer kontrolü yapılır (aynı e-posta bu arada başka kayda verildiyse geri gelmez).
   */
  function restore(type: string, id: string | number): SaveResult {
    const t = normalizeType(type);
    if (isCategory(t)) {
      const nid = resolveId(ctx, t, id);
      return t === "tag" ? tags.restore(nid) : t === "sector" ? sectors.restore(nid) : sources.restore(nid);
    }
    if (!isTrashType(t)) throw new FFError("validation", `${t} geri yüklenemez`);
    const s = String(id).trim().replace(/^#/, "");
    const rid = /^\d+$/.test(s) ? Number(s) : trashIdByLabel(t, s);
    return restoreFromTrash(ctx, t, rid, (keys) => assertKeysFree(ctx, keys));
  }

  function trashIdByLabel(t: TrashType, label: string): number {
    const hits = rows<{ record_id: number; label: string }>(ctx, "SELECT record_id, label FROM trash WHERE type = ? ORDER BY id DESC", t)
      .filter((x) => norm(x.label).includes(norm(label)));
    if (hits.length === 1) return hits[0].record_id;
    if (!hits.length) throw new FFError("not_found", `çöp kutusunda "${label}" adlı ${TYPE_LABEL[t]} yok`);
    throw new FFError("ambiguous", `"${label}" birden fazla kayıtla eşleşiyor: ${hits.slice(0, 8).map((h) => `#${h.record_id} ${h.label}`).join(", ")}`);
  }

  const find = (type: string, o: ListOpts = {}) => queries.find(normalizeType(type), o);
  const get = (type: string, id: string | number, withRel: string[] = [], relLimit?: number) => {
    const t = normalizeType(type);
    return queries.get(t, resolveId(ctx, t, id), withRel, relLimit);
  };
  const timeline = (type: string, id: string | number, limit = 20) => {
    const t = normalizeType(type);
    if (t !== "person" && t !== "opportunity" && t !== "project") throw new FFError("validation", "timeline için person, opportunity ya da project");
    return queries.timeline(t, resolveId(ctx, t, id), limit);
  };

  return {
    actor,
    // yazma servisleri (REST controller'ları ve testler kullanır)
    companies, people, sources, tags, opportunities, touches, drafts, projects, payments, tasks, comments, settings, sectors, notes, links, goals,
    posts, templates, ideas,
    // Paket 2: takip dizisi (zamanı gelenler, taslak üretimi) ve pazarlama özeti
    followups: { due: () => followupsDue(ctx), generate: () => generateFollowups(ctx) },
    marketing: () => marketingReport(ctx),
    // Paket 3: çöp kutusu
    trash: { list: () => trashList(ctx), restore },
    // okuma
    queries, reports, today: todayFn,
    network: (limit = 50) => networkLists(ctx, limit),
    personCard: (id: string | number) => queries.personCard(resolveId(ctx, "person", id)),
    companyCard: (id: string | number) => queries.companyCard(resolveId(ctx, "company", id)),
    // genel giriş (MCP araçları)
    find, get, save, saveMany, move, remove, restore, timeline,
    resolveRef: (type: "person" | "company" | "opportunity" | "project" | "source" | "sector" | "post" | "idea" | "template" | "tag", ref: string | number) => resolveRef(ctx, type, ref),
  };
}

export type Core = ReturnType<typeof createCore>;
export type { RecordType };
