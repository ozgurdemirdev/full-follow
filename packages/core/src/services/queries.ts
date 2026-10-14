import { IDEA_PRIORITIES, OPP_STAGES, OPEN_OPP_STAGES, type RecordType } from "../constants";
import { addDays } from "../dates";
import { FFError, norm, page, row, rows, type Ctx, type ListOpts } from "../context";
import { bool, has, tagsList } from "./directory";
import { listThreads, threadOf } from "./comments";
import { paymentStatus } from "./payments";
import { networkSettings, settingsService } from "./settings";
import { sectorIds } from "./sectors";

import { trashList } from "./trash";
import type { RelationDef } from "../modules/types";
import { entityHandler, isCoreType } from "./records";
import { requireRow, resolveRef, targetTable } from "./shared";
import { templateStats } from "./templates";

/** Sektör id ya da adı → o sektörün ve alt sektörlerinin id'leri (bilinmeyen sektör: boş) */
function sectorMatch(ctx: Ctx, sector: string | number): number[] {
  const sid = /^\d+$/.test(String(sector)) ? Number(sector)
    : rows<{ id: number; name: string }>(ctx, "SELECT id, name FROM sectors").find((x) => norm(x.name) === norm(String(sector)))?.id;
  return sid ? sectorIds(ctx, sid) : [];
}
import { ideaPeople, ideaStats } from "./ideas";
import { filesOf } from "./files";
import { offersOf } from "./offers";
import { teamOf } from "./oppPeople";
import { ownProjectStats } from "./ownProjects";

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
    const list = rows(ctx, `SELECT s.*, (SELECT COUNT(*) FROM opportunities x WHERE x.source_id = s.id) AS opp_count,
        (SELECT COUNT(*) FROM people x WHERE x.source_id = s.id) AS people_count, (SELECT COUNT(*) FROM companies x WHERE x.source_id = s.id) AS company_count
      FROM sources s ORDER BY s.name COLLATE NOCASE`)
      .filter((s) => (bool(f.all) || !s.deleted_at) && has(o.q, s.name, s.kind));
    return page(list, o.limit, o.offset);
  }

  function opportunities(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = rows(ctx, `
      SELECT x.*, p.name AS person_name, p.company_id, c.name AS company_name, s.name AS source_name,
        (SELECT id FROM projects WHERE opportunity_id = x.id) AS project_id
      FROM opportunities x JOIN people p ON p.id = x.person_id LEFT JOIN companies c ON c.id = p.company_id JOIN sources s ON s.id = x.source_id`);
    if (f.stage) list = list.filter((x) => x.stage === f.stage);
    if (f.person_id) list = list.filter((x) => x.person_id === Number(f.person_id));
    if (f.source_id) list = list.filter((x) => x.source_id === Number(f.source_id));
    if (bool(f.open)) list = list.filter((x) => (OPEN_OPP_STAGES as readonly string[]).includes(x.stage));
    if (bool(f.due)) list = list.filter((x) => x.next_follow_up_at && x.next_follow_up_at <= today() && (OPEN_OPP_STAGES as readonly string[]).includes(x.stage));
    if (bool(f.board)) {
      const since = addDays(today(), -30);
      list = list.filter((x) => (OPEN_OPP_STAGES as readonly string[]).includes(x.stage) || (x.closed_at && x.closed_at.slice(0, 10) >= since));
    }
    if (f.company_id) list = list.filter((x) => x.company_id === Number(f.company_id));
    list = list.filter((x) => has(o.q, x.title, x.person_name, x.company_name, x.source_name, x.source_url));
    list.sort((a, b) => OPP_STAGES.indexOf(a.stage) - OPP_STAGES.indexOf(b.stage) || a.position - b.position || a.id - b.id);
    return page(list, o.limit, o.offset);
  }

  function projects(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = rows(ctx, `
      SELECT pr.*, pe.name AS person_name,
        (SELECT COALESCE(SUM(paid_amount),0) FROM payments WHERE project_id = pr.id) AS paid_total,
        (SELECT COALESCE(SUM(expected_amount),0) FROM payments WHERE project_id = pr.id) AS expected_total
      FROM projects pr JOIN people pe ON pe.id = pr.person_id ORDER BY pr.id DESC`);
    if (f.stage) list = list.filter((p) => p.stage === f.stage);
    if (f.person_id) list = list.filter((p) => p.person_id === Number(f.person_id));
    if (bool(f.active)) list = list.filter((p) => p.stage !== "iptal" && p.stage !== "bakim" && p.stage !== "teslim");
    list = list.filter((p) => has(o.q, p.name, p.person_name));
    const sliced = page(list, o.limit, o.offset);
    // proje panosu için: sıradaki ödeme ve sıradaki görev
    sliced.rows = sliced.rows.map((p) => {
      const np = row(ctx, `SELECT id, milestone, expected_amount - paid_amount AS remaining, due_date FROM payments
        WHERE project_id = ? AND paid_amount < expected_amount ORDER BY (due_date IS NULL), due_date, id LIMIT 1`, p.id);
      return { ...p, next_payment: np ?? null, next_task: ctx.mod("calendar")?.tasks.next(p.id) ?? null };
    });
    return sliced;
  }

  function drafts(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = rows(ctx, `SELECT d.*, p.name AS person_name, c.name AS company_name, COALESCE(p.name, c.name, d.contact) AS to_name
      FROM drafts d LEFT JOIN people p ON p.id = d.person_id LEFT JOIN companies c ON c.id = d.company_id ORDER BY d.id DESC`);
    if (f.status) list = list.filter((d) => d.status === f.status);
    if (f.person_id) list = list.filter((d) => d.person_id === Number(f.person_id));
    if (f.template_id) list = list.filter((d) => d.template_id === Number(f.template_id));
    if (f.company_id) list = list.filter((d) => d.company_id === Number(f.company_id));
    if (f.company_scope) {
      const ids = new Set(rows<{ id: number }>(ctx, "SELECT id FROM people WHERE company_id = ?", f.company_scope).map((r) => r.id));
      list = list.filter((d) => d.company_id === Number(f.company_scope) || ids.has(d.person_id));
    }
    if (bool(f.followup)) list = list.filter((d) => d.followup_step);
    list = list.filter((d) => has(o.q, d.body, d.to_name));
    return page(list, o.limit, o.offset);
  }

  function payments(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = rows(ctx, `
      SELECT pa.*, pr.name AS project_name, pe.name AS person_name
      FROM payments pa JOIN projects pr ON pr.id = pa.project_id JOIN people pe ON pe.id = pr.person_id
      ORDER BY (pa.due_date IS NULL), pa.due_date, pa.id`)
      .map((p) => ({ ...p, status: paymentStatus(p, today()) }));
    if (f.project_id) list = list.filter((p) => p.project_id === Number(f.project_id));
    if (f.status) list = list.filter((p) => p.status === f.status);
    if (bool(f.overdue)) list = list.filter((p) => p.status === "gecikmis");
    if (bool(f.unpaid)) list = list.filter((p) => p.status !== "odendi");
    if (f.due_within_days !== undefined) {
      const until = addDays(today(), Number(f.due_within_days));
      list = list.filter((p) => p.status !== "odendi" && p.due_date && p.due_date <= until);
    }
    list = list.filter((p) => has(o.q, p.project_name, p.person_name, p.milestone));
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
    const list = rows(ctx, `
      SELECT s.*, p.name AS parent_name,
        (SELECT COUNT(DISTINCT x.person_id) FROM person_sectors x WHERE x.sector_id = s.id OR x.sector_id IN (SELECT id FROM sectors c WHERE c.parent_id = s.id)) AS people_count,
        (SELECT COUNT(DISTINCT x.company_id) FROM company_sectors x WHERE x.sector_id = s.id OR x.sector_id IN (SELECT id FROM sectors c WHERE c.parent_id = s.id)) AS company_count
      FROM sectors s LEFT JOIN sectors p ON p.id = s.parent_id
      ORDER BY COALESCE(p.name, s.name) COLLATE NOCASE, s.parent_id IS NOT NULL, s.name COLLATE NOCASE`)
      .map((x) => ({ ...x, path: x.parent_name ? `${x.parent_name} > ${x.name}` : x.name }))
      .filter((x) => (bool((o.filter ?? {}).all) || !x.deleted_at) && has(o.q, x.path));
    return page(list, o.limit, o.offset);
  }

  function notes(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = rows(ctx, "SELECT n.*, p.name AS person_name FROM notes n JOIN people p ON p.id = n.person_id ORDER BY n.id DESC");
    if (f.person_id) list = list.filter((n) => n.person_id === Number(f.person_id));
    list = list.filter((n) => has(o.q, n.body, n.person_name));
    return page(list, o.limit, o.offset);
  }

  // ---------- Paket 2: pazarlama ----------
  function templates(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = templateStats(ctx);
    if (f.kind) list = list.filter((t) => t.kind === f.kind);
    if (f.channel) list = list.filter((t) => !t.channel || t.channel === f.channel);
    if (f.sector) {
      const ids = sectorMatch(ctx, f.sector);
      list = list.filter((t) => !t.sector_id || ids.includes(t.sector_id));
    }
    list = list.filter((t) => has(o.q, t.name, t.body, t.sector_path));
    return page(list, o.limit, o.offset);
  }

  function ideas(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = ideaStats(ctx);
    if (f.stage) list = list.filter((i) => i.stage === f.stage);
    if (f.sector) {
      const ids = sectorMatch(ctx, f.sector);
      list = list.filter((i) => i.sectors.some((s: { id: number }) => ids.includes(s.id)));
    }
    if (f.own_project) {
      const pid = resolveRef(ctx, "own_project", f.own_project);
      list = list.filter((i) => i.own_project_id === pid);
    }
    if (f.general) list = list.filter((i) => i.own_project_id == null);
    list = list.filter((i) => has(o.q, i.title, i.problem, i.notes));
    return page(list, o.limit, o.offset);
  }

  function ownProjects(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = ownProjectStats(ctx);
    for (const k of ["status", "sellable"] as const) {
      if (f[k]) { const want = String(f[k]).split(",").map((x) => x.trim()); list = list.filter((p) => want.includes(p[k])); }
    }
    if (f.sector) {
      const ids = sectorMatch(ctx, f.sector);
      list = list.filter((p) => p.sectors.some((s: { id: number }) => ids.includes(s.id)));
    }
    list = list.filter((p) => has(o.q, p.name, p.description, p.notes));
    return page(list, o.limit, o.offset);
  }

  function interests(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = ideaPeople(ctx, f.idea_id ? Number(f.idea_id) : undefined, f.person_id ? Number(f.person_id) : undefined);
    if (f.interest) list = list.filter((x) => x.interest === f.interest);
    list = list.filter((x) => has(o.q, x.person_name, x.idea_title, x.note));
    return page(list, o.limit, o.offset);
  }

  function settings(): Rows {
    const s = { ...settingsService(ctx).all(), ...networkSettings(ctx) };
    const list = Object.entries(s).map(([key, value]) => ({ key, value: typeof value === "object" ? JSON.stringify(value) : value }));
    return { rows: list, total: list.length };
  }

  const LISTS: Record<Exclude<RecordType, "setting"> | "setting", (o: ListOpts) => Rows> = {
    source: sources, opportunity: opportunities, project: projects,
    draft: drafts, payment: payments, comment: comments, setting: settings,
    sector: sectors, note: notes, link: linkList, offer: offerList, template: templates, idea: ideas, own_project: ownProjects, interest: interests, tag: tags,
    trash: (o) => {
      const t = (o.filter ?? {}).type;
      return page(trashList(ctx).filter((x) => (!t || x.type === t) && has(o.q, x.label)), o.limit, o.offset);
    },
  };

  /** Offer versions, newest first; filter: {opportunity_id} */
  function offerList(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = rows(ctx, "SELECT x.*, op.title AS opportunity_title FROM offers x JOIN opportunities op ON op.id = x.opportunity_id ORDER BY x.opportunity_id, x.version DESC")
      .map((r) => ({ ...r, items: JSON.parse(r.items) }));
    if (f.opportunity_id) list = list.filter((r) => r.opportunity_id === Number(f.opportunity_id));
    list = list.filter((r) => has(o.q, r.opportunity_title, r.note));
    return page(list, o.limit, o.offset);
  }

  /** Links of an opportunity or project; a project also lists the links of its opportunity (from: "fırsat") */
  function linkList(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = rows(ctx, "SELECT * FROM links ORDER BY id");
    if (f.opportunity_id) list = list.filter((l) => l.target_type === "opportunity" && l.target_id === Number(f.opportunity_id));
    if (f.own_project_id) list = list.filter((l) => l.target_type === "own_project" && l.target_id === Number(f.own_project_id));
    if (f.project_id) {
      const oppId = row<{ opportunity_id: number | null }>(ctx, "SELECT opportunity_id FROM projects WHERE id = ?", Number(f.project_id))?.opportunity_id;
      list = list.filter((l) => (l.target_type === "project" && l.target_id === Number(f.project_id)) || (oppId && l.target_type === "opportunity" && l.target_id === oppId))
        .map((l) => (l.target_type === "opportunity" ? { ...l, from: "fırsat" } : l));
    }
    list = list.filter((l) => has(o.q, l.label, l.url));
    return page(list, o.limit, o.offset);
  }

  function find(type: string, o: ListOpts = {}) {
    const opts = { ...o, limit: o.limit ?? 20, offset: o.offset ?? 0 };
    return isCoreType(type) ? LISTS[type](opts) : entityHandler(ctx, type, "find")(ctx, opts);
  }

  // ---------- tek kayıt ----------
  /** Relations of the record types core owns; a module type lists its own (`related`) and the modules add theirs (`relations` contribution: touches, tasks, referrals, ...) */
  const relatedFor: Record<string, string[]> = {
    opportunity: ["comments", "drafts", "links", "people", "offers", "files"],
    project: ["payments", "comments", "drafts", "links"],
    payment: ["comments"], draft: ["comments"],
    own_project: ["ideas", "links", "comments"],
    idea: ["people", "comments"], template: ["drafts"],
  };

  /** Tek kayıt + isteğe bağlı ilişkili kayıtlar (with). Her ilişkili liste en fazla relLimit (varsayılan 10) satır. */
  function get(type: string, id: number, withRel: string[] = [], relLimit = 10) {
    const own = (r: any) => (r === undefined ? undefined : r);
    let rowData: any;
    if (!isCoreType(type)) rowData = entityHandler(ctx, type, "get")(ctx, id);
    else switch (type) {
      case "source": rowData = own(find("source", { filter: { all: true }, limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "opportunity": rowData = own(find("opportunity", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "project": rowData = own(find("project", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "draft": rowData = own(find("draft", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "payment": rowData = own(find("payment", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "sector": rowData = own(find("sector", { filter: { all: true }, limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "tag": rowData = own(find("tag", { filter: { all: true }, limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "trash": throw new FFError("validation", "çöp kutusu için find(type: trash) kullan");
      case "note": rowData = own(find("note", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "link": rowData = own(row(ctx, "SELECT * FROM links WHERE id = ?", id)); break;
      case "offer": rowData = own(offerList({ filter: {}, limit: 100000 }).rows.find((r) => r.id === id)); break;
      case "template": rowData = own(templateStats(ctx).find((p) => p.id === id)); break;
      case "idea": rowData = own(ideaStats(ctx).find((p) => p.id === id)); break;
      case "own_project": rowData = own(ownProjectStats(ctx).find((p) => p.id === id)); break;
      case "interest": rowData = own(ideaPeople(ctx).find((p) => p.id === id)); break;
      case "comment": {
        const c = requireRow(ctx, "comments", id);
        const root = c.parent_id ? requireRow(ctx, "comments", c.parent_id) : c;
        rowData = threadOf(ctx, root, true);
        break;
      }
      case "setting": throw new FFError("validation", "ayarlar için find(type: setting) kullan");
    }
    if (!rowData) throw new FFError("not_found", `${type} #${id} bulunamadı`);

    const related: Record<string, any[]> = {};
    // relations the installed modules load (for example the tasks of a person)
    const moduleRelations: Record<string, RelationDef> = Object.assign({}, ...ctx.contrib("relations"));
    const allowed = [
      ...(relatedFor[type] ?? ctx.types.entity(type)?.related ?? []),
      ...Object.entries(moduleRelations).filter(([, r]) => r.on.includes(type)).map(([name]) => name),
    ];
    const n = Math.min(Math.max(1, relLimit), 200);
    const cap = (r: Rows) => r.rows.slice(0, n);
    for (const name of withRel) {
      if (!allowed.includes(name)) throw new FFError("validation", `${type} için geçerli ilişkiler: ${allowed.join(", ") || "yok"}`);
      const by = { [`${type}_id`]: id };
      switch (name) {
        case "opportunities": related.opportunities = cap(opportunities({ filter: by, limit: n })); break;
        case "projects": related.projects = cap(projects({ filter: by, limit: n })); break;
        case "payments": related.payments = cap(payments({ filter: by, limit: n })); break;
        // a company's drafts are those written to it or to its people
        case "drafts": related.drafts = cap(drafts({ filter: type === "company" ? { company_scope: id } : by, limit: n })); break;
        case "offers": related.offers = offersOf(ctx, id).slice(0, n); break;
        case "files": related.files = filesOf(ctx, "opportunity", id).slice(0, n); break;
        case "people":
          related.people = type === "opportunity" ? teamOf(ctx, id).slice(0, n) : type === "idea" ? ideaPeople(ctx, id).slice(0, n) : moduleRelations.people?.load(ctx, by, n, rowData) ?? [];
          break;
        case "ideas": {
          const prio = (x: any) => IDEA_PRIORITIES.indexOf(x.priority);
          related.ideas = ideaStats(ctx).filter((i) => i.own_project_id === id)
            .sort((a, b) => Number(!!a.done_at) - Number(!!b.done_at) || (a.done_at ? b.done_at.localeCompare(a.done_at) : prio(a) - prio(b) || a.position - b.position || a.id - b.id))
            .slice(0, n);
          break;
        }
        case "links": related.links = cap(linkList({ filter: by, limit: n })); break;
        case "notes": related.notes = cap(notes({ filter: { person_id: id }, limit: n })); break;
        case "comments": related.comments = listThreads(ctx, { target_type: type, target_id: id, resolved: "all" }).slice(0, n); break;
        default: related[name] = moduleRelations[name].load(ctx, by, n, rowData);
      }
    }
    // açık yorum konusu sayısı (Claude cevapsız yorumu fark etsin)
    let comments_open: number | undefined;
    if (targetTable(ctx, type)) comments_open = listThreads(ctx, { target_type: type, target_id: id }).length;
    return { type, id, row: rowData, related, comments_open };
  }

  /** Kişi / fırsat / proje olayları: son N olay, eskiden yeniye */
  function timeline(type: "person" | "opportunity" | "project", id: number, limit = 20) {
    const col = { person: "person_id", opportunity: "opportunity_id", project: "project_id" }[type];
    if (!col) throw new FFError("validation", "timeline için type: person, opportunity ya da project");
    const list = rows(ctx, `SELECT * FROM events WHERE ${col} = ? ORDER BY id DESC LIMIT ?`, id, limit).reverse();
    return list.map((e) => ({ ...e, data: e.data ? JSON.parse(e.data) : null }));
  }

  return { find, get, timeline, sectors, tags, notes, templates, ideas, interests, opportunities, projects, drafts, payments, comments, sources };
}
