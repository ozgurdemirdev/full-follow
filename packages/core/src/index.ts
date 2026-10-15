import type { Actor, RecordType } from "./constants";
import { FFError, norm, rows, systemClock, type Clock, type Ctx, type DuplicateHit, type ListOpts } from "./context";
import type { DbHandle } from "./db/client";
import { sourcesService, tagsService } from "./services/categories";
import { commentsService } from "./services/comments";
import { assertKeysFree, recordSkipped } from "./services/dupes";
import { queriesFor } from "./services/queries";
import { linksService } from "./services/links";
import { filesService } from "./services/files";
import { notesService } from "./services/notes";
import { entityHandler, isCoreType, normalizeType, resolveId } from "./services/records";
import { sectorsService } from "./services/sectors";
import { settingsService } from "./services/settings";
import { resolveInput, resolveRef } from "./services/shared";
import { todayService } from "./services/today";
import { isCategory, isTrashType, restoreFromTrash, trashList, typeLabel } from "./services/trash";
import { createRegistry, type ModuleRegistry } from "./modules/registry";
import type { SaveResult } from "./modules/types";

export * from "./constants";
export * from "./dates";
export * from "./i18n";
export { openDb, defaultDbPath, loadRootEnv, backupDb, type DbHandle, type Db } from "./db/client";
export { FFError, systemClock, type Clock, type ListOpts, type ErrorCode, type DuplicateHit } from "./context";
export type { Thread } from "./services/comments";
export type { TrashItem } from "./services/trash";

export * from "./modules";
export type * from "./contracts";

// ---- What a module's services and server code build on ("service kit") ----
export { assertOzgur, emit as writeEvent, keptRow, keptRows, money, norm, page, parse, row, rows, stamp, type Ctx, type EventInput } from "./context";
export { placeInGroup, renumberGroup, requireRow, requireTarget, resolveRef, truncate, link as eventLink } from "./services/shared";
export { filesOf } from "./services/files";
export { announceTrashed, Bin } from "./services/trash";
export { bool, has, labelFilter, stripKeys } from "./services/directory";
export { addTagBySlug, assignSectors, assignTags, checkSource, labelFields, sectorsOf, tagsOf, withSectorList } from "./services/categories";
export { assertUnique, keyList } from "./services/dupes";
export { COMPANY_TOUCHES, isColdEmail, renderTemplate, REPLIED_AFTER, resolveSubject, sameSide, subjectInfo, subjectWhere, type ResolvedSubject, type Subject } from "./services/subject";
export { ensureSector, sectorInput, sectorMatch, setSectorLinks, type SectorLinks } from "./services/sectors";
export { hiddenModules, marketingSettings, networkSettings, postRefreshDays, readSetting, readTemplate, settingsService, settingValues } from "./services/settings";
export { queriesFor } from "./services/queries";
export { listThreads } from "./services/comments";
export { cleanName, HttpFailure, refuse, sniff, type Detected, type UploadType } from "./services/uploads";
export { normalizeType, resolveId } from "./services/records";
export { companyKeys, contactKey, domainKey, personKeys } from "./keys";
export * as schema from "./db/schema";
export * as zodKit from "./schemas/kit";
export * as coreSchemas from "./schemas";
export * as docKit from "./openapi";
export type { DocKey, HttpMethod, RouteDoc, RouteDocs } from "./openapi";
export type { Q } from "./db/client";
export { APP_TOKEN, CLAUDE_APP_TOKEN, intId, listOpts, withList } from "./http";

/** Toplu kayıt sonucu: eklenenler, mükerrer diye atlananlar, hata verenler (sıra numarasıyla) */
export interface BulkResult {
  created: { index: number; id: number; label: string; effects: string[] }[];
  skipped: { index: number; label: string; existing: DuplicateHit }[];
  failed: { index: number; label: string; error: string }[];
}

/**
 * Çekirdek: web (NestJS, actor="ozgur") ve MCP (actor="claude") sadece buradan geçer.
 * `actor` giriş noktasından gelir; girdideki created_by asla kabul edilmez.
 */
export function createCore(handle: DbHandle, actor: Actor, clock: Clock = systemClock, registry: ModuleRegistry = createRegistry()) {
  const ctx = { db: handle.db, sqlite: handle.sqlite, actor, clock } as Ctx;
  Object.assign(ctx, registry.bind(ctx));
  /** alias or name to the canonical record type; core types and the installed modules' types */
  const typeOf = (type: string) => normalizeType(ctx, type);

  const sources = sourcesService(ctx);
  const tags = tagsService(ctx);
  const comments = commentsService(ctx);
  const sectors = sectorsService(ctx);
  const notes = notesService(ctx);
  const links = linksService(ctx);
  const files = filesService(ctx);
  const settings = settingsService(ctx);
  const queries = queriesFor(ctx);
  const todayFn = todayService(ctx);

  /** Kayıt oluştur ya da güncelle (id verilirse güncelle). Aşama değişikliği burada yapılmaz. */
  function save(type: string, data: Record<string, any>, id?: string | number): SaveResult {
    const t = typeOf(type);
    const d = resolveInput(ctx, ctx.types.entity(t)?.prepare?.(ctx, data ?? {}) ?? data ?? {});
    const nid = id === undefined || id === null || id === "" ? undefined : resolveId(ctx, t, id);
    if (!isCoreType(t)) return entityHandler(ctx, t, "save")(ctx, d, nid);
    switch (t) {
      case "source": return nid ? sources.update(nid, d) : sources.create(d);
      case "tag": return nid ? tags.update(nid, d) : tags.create(d);
      case "sector": return nid ? sectors.update(nid, d) : sectors.create(d);
      case "note": return nid ? notes.update(nid, d) : notes.create(d);
      case "link": return nid ? links.update(nid, d) : links.create(d);
      case "comment": return nid ? comments.update(nid, d) : comments.add(d);
      case "setting": return settings.setMany(d);
      case "trash": throw new FFError("validation", "çöp kutusuna kayıt yazılmaz; geri yüklemek için restore");
    }
  }

  /**
   * Toplu ekleme (MCP'ye verilen listeler): her kayıt ayrı denenir, mükerrerler atlanır ve hangi kayıtla çakıştığı söylenir.
   * Tek transaction içinde çalışır (hızlı); hata veren kayıt sadece kendisini geri alır.
   */
  function saveMany(type: string, items: Record<string, any>[]): BulkResult {
    const t = typeOf(type);
    const out: BulkResult = { created: [], skipped: [], failed: [] };
    const labelOf = (d: Record<string, any>) => String(d?.name ?? d?.title ?? d?.email ?? d?.contact ?? d?.summary ?? "").slice(0, 60);
    ctx.sqlite.transaction(() => {
      items.forEach((item, index) => {
        try {
          const r = save(t, item);
          out.created.push({ index, id: r.row?.id, label: labelOf(item), effects: r.effects });
        } catch (e) {
          if (e instanceof FFError && e.code === "duplicate" && e.duplicate) out.skipped.push({ index, label: labelOf(item), existing: e.duplicate });
          else out.failed.push({ index, label: labelOf(item), error: e instanceof Error ? e.message : String(e) });
        }
      });
      const bulk = ctx.types.entity(t)?.bulk;
      if (bulk) recordSkipped(ctx, t, bulk.label, out.skipped.flatMap((s) => bulk.keys(items[s.index])), out.skipped.length);
    })();
    return out;
  }

  /** Stage change: the types whose module has a `move` handler (opportunities, projects, ideas, own projects) */
  function move(type: string, id: string | number, stage: string, reason?: string, position?: number): SaveResult {
    const t = typeOf(type);
    const nid = resolveId(ctx, t, id);
    const moveStage = ctx.types.entity(t)?.move;
    if (moveStage) return moveStage(ctx, nid, { stage, reason, position });
    const movable = ctx.types.entityTypes().filter((x) => ctx.types.entity(x)?.move);
    throw new FFError("validation", `move sadece ${movable.join(", ")} için`);
  }

  /** Silme: kayıt çöp kutusuna gider (restore ile geri gelir); etiket, sektör ve kaynak yerinde gizlenir */
  function remove(type: string, id: string | number): SaveResult {
    const t = typeOf(type);
    const nid = resolveId(ctx, t, id);
    if (!isCoreType(t)) return entityHandler(ctx, t, "delete")(ctx, nid);
    switch (t) {
      case "source": return { ...sources.remove(nid), trash: { type: "source", id: nid } };
      case "tag": return { ...tags.remove(nid), trash: { type: "tag", id: nid } };
      case "sector": return { ...sectors.remove(nid), trash: { type: "sector", id: nid } };
      case "comment": return comments.remove(nid);
      case "note": return notes.remove(nid);
      case "link": return links.remove(nid);
      case "setting": throw new FFError("validation", "ayar silinmez");
      case "trash": throw new FFError("validation", "çöp kutusundan kalıcı silme yok");
    }
  }

  /**
   * Geri yükleme: silinen kayıt (id ya da çöp kutusundaki adıyla) ya da gizlenen etiket/sektör/kaynak.
   * Kişi ve firmada mükerrer kontrolü yapılır (aynı e-posta bu arada başka kayda verildiyse geri gelmez).
   */
  function restore(type: string, id: string | number): SaveResult {
    // records a module hides in place (a chat session) come back through that module
    const hidden = ctx.contrib("softTrash").find((def) => def.type === type);
    if (hidden) return hidden.restore(ctx, Number(id));
    const t = isTrashType(ctx, type) ? type : typeOf(type);
    if (isCategory(t)) {
      const nid = resolveId(ctx, t, id);
      return t === "tag" ? tags.restore(nid) : t === "sector" ? sectors.restore(nid) : sources.restore(nid);
    }
    if (!isTrashType(ctx, t)) throw new FFError("validation", `${t} geri yüklenemez`);
    const s = String(id).trim().replace(/^#/, "");
    const rid = /^\d+$/.test(s) ? Number(s) : trashIdByLabel(t, s);
    return restoreFromTrash(ctx, t, rid, (keys) => assertKeysFree(ctx, keys));
  }

  function trashIdByLabel(t: string, label: string): number {
    const hits = rows<{ record_id: number; label: string }>(ctx, "SELECT record_id, label FROM trash WHERE type = ? ORDER BY id DESC", t)
      .filter((x) => norm(x.label).includes(norm(label)));
    if (hits.length === 1) return hits[0].record_id;
    if (!hits.length) throw new FFError("not_found", `çöp kutusunda "${label}" adlı ${typeLabel(ctx, t)} yok`);
    throw new FFError("ambiguous", `"${label}" birden fazla kayıtla eşleşiyor: ${hits.slice(0, 8).map((h) => `#${h.record_id} ${h.label}`).join(", ")}`);
  }

  const find = (type: string, o: ListOpts = {}) => queries.find(typeOf(type), o);
  const get = (type: string, id: string | number, withRel: string[] = [], relLimit?: number) => {
    const t = typeOf(type);
    return queries.get(t, resolveId(ctx, t, id), withRel, relLimit);
  };

  return {
    actor,
    /** installed feature modules (key, label) */
    modules: { has: registry.has, list: registry.list },
    /** what the installed modules put in `/api/meta` (lists and labels for the forms) */
    moduleMeta: (): Record<string, unknown> => Object.assign({}, ...ctx.contrib("meta")),
    /** scheduled work of the installed modules (the server host runs it with `startJobs`) */
    jobs: () => ctx.contrib("jobs").flat(),
    /** typed access to another module's API; undefined when that module is not installed */
    mod: ctx.mod,
    /** record types comments can hang on: core's and the installed modules' */
    commentTargets: (): string[] => ctx.types.commentTargets(),
    /** the context services run with (actor, clock, db): module tools (MCP) call their module's API through it */
    ctx,
    /** alias or name to the canonical record type; unknown types and types of modules that are not installed are a clear error */
    normalizeType: typeOf,
    // yazma servisleri (REST controller'ları ve testler kullanır)
    sources, tags, comments, settings, sectors, notes, links,
    files,
    // Paket 3: çöp kutusu
    trash: { list: () => trashList(ctx), restore },
    // okuma
    queries, today: todayFn,
    // genel giriş (MCP araçları)
    find, get, save, saveMany, move, remove, restore,
    resolveRef: (type: string, ref: string | number) => resolveRef(ctx, type, ref),
  };
}

export type Core = ReturnType<typeof createCore>;
export type { RecordType };
