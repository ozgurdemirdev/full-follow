import { LIST_PAGE_SIZE, RELATED_ROWS_DEFAULT, RELATED_ROWS_MAX, type RecordType } from "../constants";
import { FFError, norm, page, row, rows, type Ctx, type ListOpts } from "../context";
import { m } from "../messages";
import { bool, has, idsOf, inIds, tagsList } from "./directory";
import { listThreads, threadOf } from "./comments";
import { lastActorOf } from "./lastActor";
import { networkSettings, settingsService } from "./settings";

import { trashList } from "./trash";
import type { RelationDef } from "../modules/types";
import { entityHandler, isCoreType } from "./records";
import { requireRow, resolveRef, targetTable } from "./shared";


type Rows = { rows: any[]; total: number };

/** The queries, built once per context (services call it for lists of records core still owns) */
const cache = new WeakMap<Ctx, ReturnType<typeof queriesService>>();
export function queriesFor(ctx: Ctx) {
  let q = cache.get(ctx);
  if (!q) cache.set(ctx, (q = queriesService(ctx)));
  return q;
}

function queriesService(ctx: Ctx) {
  const today = () => ctx.clock.today();

  // ---------- listeler ----------
  const tags = (o: ListOpts) => tagsList(ctx, o);

  function sources(o: ListOpts): Rows {
    const f = o.filter ?? {};
    const ids = idsOf(f);
    const counts = Object.entries(Object.assign({}, ...ctx.contrib("sourceCounts").map((f) => f(ctx)))) as [string, Map<number, number>][];
    const list = rows(ctx, `SELECT s.*,
        (SELECT COUNT(*) FROM people x WHERE x.source_id = s.id) AS people_count, (SELECT COUNT(*) FROM companies x WHERE x.source_id = s.id) AS company_count
      FROM sources s ${ids ? `WHERE ${inIds("s.id")}` : ""} ORDER BY s.name COLLATE NOCASE`, ...(ids ? [JSON.stringify(ids)] : []))
      .map((s) => ({ ...s, ...Object.fromEntries(counts.map(([column, byId]) => [column, byId.get(s.id) ?? 0])) }))
      .filter((s) => (bool(f.all) || !s.deleted_at) && has(o.q, s.name, s.kind));
    return page(list, o.limit, o.offset);
  }

  function comments(o: ListOpts): Rows {
    const f = o.filter ?? {};
    const list = listThreads(ctx, {
      target_type: f.target_type, target_id: f.target_id ? Number(f.target_id) : undefined,
      unanswered: bool(f.unanswered), last_by: f.last_by,
      resolved: f.resolved === "all" ? "all" : bool(f.resolved),
      messages: bool(f.messages),
    }).filter((t) => has(o.q, t.last_body, t.target_label));
    return page(list, o.limit, o.offset);
  }

  function sectors(o: ListOpts): Rows {
    const ids = idsOf(o.filter ?? {});
    const list = rows(ctx, `
      SELECT s.*, p.name AS parent_name,
        (SELECT COUNT(DISTINCT x.person_id) FROM person_sectors x WHERE x.sector_id = s.id OR x.sector_id IN (SELECT id FROM sectors c WHERE c.parent_id = s.id)) AS people_count,
        (SELECT COUNT(DISTINCT x.company_id) FROM company_sectors x WHERE x.sector_id = s.id OR x.sector_id IN (SELECT id FROM sectors c WHERE c.parent_id = s.id)) AS company_count
      FROM sectors s LEFT JOIN sectors p ON p.id = s.parent_id ${ids ? `WHERE ${inIds("s.id")}` : ""}
      ORDER BY COALESCE(p.name, s.name) COLLATE NOCASE, s.parent_id IS NOT NULL, s.name COLLATE NOCASE`, ...(ids ? [JSON.stringify(ids)] : []))
      .map((x) => ({ ...x, path: x.parent_name ? `${x.parent_name} > ${x.name}` : x.name }))
      .filter((x) => (bool((o.filter ?? {}).all) || !x.deleted_at) && has(o.q, x.path));
    return page(list, o.limit, o.offset);
  }

  function notes(o: ListOpts): Rows {
    const f = o.filter ?? {};
    const ids = idsOf(f);
    const where = [...(ids ? [inIds("n.id")] : []), ...(f.person_id ? ["n.person_id = ?"] : [])];
    const list = rows(ctx, `SELECT n.*, p.name AS person_name FROM notes n JOIN people p ON p.id = n.person_id ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY n.id DESC`,
      ...(ids ? [JSON.stringify(ids)] : []), ...(f.person_id ? [Number(f.person_id)] : []))
      .filter((n) => has(o.q, n.body, n.person_name));
    return page(list, o.limit, o.offset);
  }

  function settings(): Rows {
    const s = { ...settingsService(ctx).all(), ...networkSettings(ctx) };
    const list = Object.entries(s).map(([key, value]) => ({ key, value: typeof value === "object" ? JSON.stringify(value) : value }));
    return { rows: list, total: list.length };
  }

  const LISTS: Record<Exclude<RecordType, "setting"> | "setting", (o: ListOpts) => Rows> = {
    source: sources,
    comment: comments, setting: settings,
    sector: sectors, note: notes, link: linkList, tag: tags,
    trash: (o) => {
      const t = (o.filter ?? {}).type;
      return page(trashList(ctx).filter((x) => (!t || x.type === t) && has(o.q, x.label)), o.limit, o.offset);
    },
  };

  /** Links of a record (filter `<type>_id` for a type links can hang on); a record also lists the links of the record its module says they come from (a project: its opportunity, marked from: "fırsat") */
  function linkList(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = rows(ctx, "SELECT * FROM links ORDER BY id");
    for (const type of ctx.types.linkTargets()) {
      const id = f[`${type}_id`];
      if (!id) continue;
      const parent = ctx.types.commentTarget(type)?.linksFrom?.(ctx, Number(id));
      list = list.filter((l) => (l.target_type === type && l.target_id === Number(id)) || (parent && l.target_type === parent.type && l.target_id === parent.id))
        .map((l) => (parent && l.target_type === parent.type ? { ...l, from: parent.from } : l));
    }
    list = list.filter((l) => has(o.q, l.label, l.url));
    return page(list, o.limit, o.offset);
  }

  function find(type: string, o: ListOpts = {}) {
    const opts = { ...o, limit: o.limit ?? LIST_PAGE_SIZE, offset: o.offset ?? 0 };
    return isCoreType(type) ? LISTS[type](opts) : entityHandler(ctx, type, "find")(ctx, opts);
  }

  // ---------- tek kayıt ----------
  /** Tek kayıt + isteğe bağlı ilişkili kayıtlar (with). Her ilişkili liste en fazla relLimit (varsayılan 10) satır. */
  function get(type: string, id: number, withRel: string[] = [], relLimit = RELATED_ROWS_DEFAULT) {
    const own = (r: any) => (r === undefined ? undefined : r);
    let rowData: any;
    if (!isCoreType(type)) rowData = entityHandler(ctx, type, "get")(ctx, id);
    else switch (type) {
      case "source": rowData = own(find("source", { filter: { all: true, ids: [id] }, limit: 1 }).rows[0]); break;
      case "sector": rowData = own(find("sector", { filter: { all: true, ids: [id] }, limit: 1 }).rows[0]); break;
      case "tag": rowData = own(find("tag", { filter: { all: true, ids: [id] }, limit: 1 }).rows[0]); break;
      case "trash": throw new FFError("validation", m.records.trashUseFind);
      case "note": rowData = own(find("note", { filter: { ids: [id] }, limit: 1 }).rows[0]); break;
      case "link": rowData = own(row(ctx, "SELECT * FROM links WHERE id = ?", id)); break;
      case "comment": {
        const c = requireRow(ctx, "comments", id);
        const root = c.parent_id ? requireRow(ctx, "comments", c.parent_id) : c;
        rowData = threadOf(ctx, root, true);
        break;
      }
      case "setting": throw new FFError("validation", m.records.settingUseFind);
    }
    if (!rowData) throw new FFError("not_found", m.notFound(type, id));

    const related: Record<string, any[]> = {};
    // relations the installed modules load (for example the tasks of a person)
    // (a name can be served by two modules for different types: people of a company, people of an opportunity)
    const moduleRelations: [string, RelationDef][] = ctx.contrib("relations").flatMap((m) => Object.entries(m));
    const relationFor = (name: string) => moduleRelations.find(([n, r]) => n === name && r.on.includes(type))?.[1];
    const allowed = [
      // a module type lists its own (`related`) and the modules add theirs (`relations` contribution: touches, tasks, referrals, drafts, ...)
      ...(ctx.types.entity(type)?.related ?? []),
      ...moduleRelations.filter(([, r]) => r.on.includes(type)).map(([name]) => name),
    ];
    const n = Math.min(Math.max(1, relLimit), RELATED_ROWS_MAX);
    const cap = (r: Rows) => r.rows.slice(0, n);
    for (const name of withRel) {
      if (!allowed.includes(name)) throw new FFError("validation", m.records.relationsInvalid(type, allowed.join(", ") || m.none));
      const by = { [`${type}_id`]: id };
      switch (name) {
        case "links": related.links = cap(linkList({ filter: by, limit: n })); break;
        case "notes": related.notes = cap(notes({ filter: { person_id: id }, limit: n })); break;
        case "comments": related.comments = listThreads(ctx, { target_type: type, target_id: id, resolved: "all" }).slice(0, n); break;
        // a name an entity lists in `related` that no installed module serves (the people of a post without the people module) is empty
        default: related[name] = relationFor(name)?.load(ctx, by, n, rowData) ?? [];
      }
    }
    // açık yorum konusu sayısı (Claude cevapsız yorumu fark etsin)
    let comments_open: number | undefined;
    if (targetTable(ctx, type)) comments_open = listThreads(ctx, { target_type: type, target_id: id }).length;
    return { type, id, row: rowData, related, comments_open, last_actor: lastActorOf(ctx, type, id) };
  }

  return { find, get, sectors, tags, notes, comments, sources };
}
