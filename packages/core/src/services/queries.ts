import { OPP_STAGES, OPEN_OPP_STAGES, type RecordType } from "../constants";
import { addDays } from "../dates";
import { FFError, norm, page, row, rows, type Ctx, type ListOpts } from "../context";
import { listThreads, threadOf } from "./comments";
import { paymentStatus } from "./payments";
import { settingsService } from "./settings";
import { requireRow } from "./shared";

type Rows = { rows: any[]; total: number };

const has = (q: string | undefined, ...fields: (string | null | undefined)[]) => {
  if (!q) return true;
  const n = norm(q);
  return fields.some((f) => norm(f).includes(n));
};
const bool = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";
const OPEN = OPEN_OPP_STAGES.map((s) => `'${s}'`).join(",");

export function queriesService(ctx: Ctx) {
  const today = () => ctx.clock.today();

  // ---------- listeler ----------
  function people(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = rows(ctx, `
      SELECT p.*, c.name AS company_name, r.name AS referred_by_name,
        (SELECT group_concat(tag) FROM person_tags t WHERE t.person_id = p.id) AS tag_list
      FROM people p LEFT JOIN companies c ON c.id = p.company_id LEFT JOIN people r ON r.id = p.referred_by_id
      ORDER BY (p.next_follow_up_at IS NULL), p.next_follow_up_at, p.name`)
      .map(({ tag_list, ...p }) => ({ ...p, tags: tag_list ? String(tag_list).split(",").sort() : [] }));
    if (f.tag) list = list.filter((p) => p.tags.includes(f.tag));
    if (f.company_id) list = list.filter((p) => p.company_id === Number(f.company_id));
    if (f.referred_by_id) list = list.filter((p) => p.referred_by_id === Number(f.referred_by_id));
    if (bool(f.follow_up_due)) list = list.filter((p) => p.next_follow_up_at && p.next_follow_up_at <= today());
    list = list.filter((p) => has(o.q, p.name, p.email, p.handle, p.phone, p.company_name));
    return page(list, o.limit, o.offset);
  }

  function companies(o: ListOpts): Rows {
    const list = rows(ctx, `SELECT c.*, (SELECT COUNT(*) FROM people p WHERE p.company_id = c.id) AS people_count FROM companies c ORDER BY c.name`)
      .filter((c) => has(o.q, c.name, c.website));
    return page(list, o.limit, o.offset);
  }

  function sources(o: ListOpts): Rows {
    const list = rows(ctx, `SELECT s.*, (SELECT COUNT(*) FROM opportunities x WHERE x.source_id = s.id) AS opp_count FROM sources s ORDER BY s.name`)
      .filter((s) => has(o.q, s.name, s.kind));
    return page(list, o.limit, o.offset);
  }

  function opportunities(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = rows(ctx, `
      SELECT x.*, p.name AS person_name, s.name AS source_name,
        (SELECT id FROM projects WHERE opportunity_id = x.id) AS project_id
      FROM opportunities x JOIN people p ON p.id = x.person_id JOIN sources s ON s.id = x.source_id`);
    if (f.stage) list = list.filter((x) => x.stage === f.stage);
    if (f.person_id) list = list.filter((x) => x.person_id === Number(f.person_id));
    if (f.source_id) list = list.filter((x) => x.source_id === Number(f.source_id));
    if (bool(f.open)) list = list.filter((x) => (OPEN_OPP_STAGES as readonly string[]).includes(x.stage));
    if (bool(f.due)) list = list.filter((x) => x.next_follow_up_at && x.next_follow_up_at <= today() && (OPEN_OPP_STAGES as readonly string[]).includes(x.stage));
    if (bool(f.board)) {
      const since = addDays(today(), -30);
      list = list.filter((x) => (OPEN_OPP_STAGES as readonly string[]).includes(x.stage) || (x.closed_at && x.closed_at.slice(0, 10) >= since));
    }
    list = list.filter((x) => has(o.q, x.title, x.person_name, x.source_name));
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
      const nt = row(ctx, `SELECT id, title, due_date FROM tasks WHERE project_id = ? AND done_at IS NULL ORDER BY (due_date IS NULL), due_date, id LIMIT 1`, p.id);
      return { ...p, next_payment: np ?? null, next_task: nt ?? null };
    });
    return sliced;
  }

  function tasks(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = rows(ctx, `
      SELECT t.*, p.name AS person_name, op.title AS opportunity_title, pr.name AS project_name
      FROM tasks t LEFT JOIN people p ON p.id = t.person_id LEFT JOIN opportunities op ON op.id = t.opportunity_id
      LEFT JOIN projects pr ON pr.id = t.project_id
      ORDER BY (t.due_date IS NULL), t.due_date, t.id`);
    const wantDone = bool(f.done);
    if (!bool(f.all)) list = list.filter((t) => (wantDone ? !!t.done_at : !t.done_at));
    if (f.assignee) list = list.filter((t) => t.assignee === f.assignee);
    if (bool(f.overdue)) list = list.filter((t) => t.due_date && t.due_date < today());
    if (bool(f.due)) list = list.filter((t) => t.due_date && t.due_date <= today());
    for (const k of ["person_id", "opportunity_id", "project_id"]) if (f[k]) list = list.filter((t) => t[k] === Number(f[k]));
    list = list.filter((t) => has(o.q, t.title, t.person_name, t.opportunity_title, t.project_name));
    return page(list, o.limit, o.offset);
  }

  function drafts(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = rows(ctx, `SELECT d.*, p.name AS person_name FROM drafts d JOIN people p ON p.id = d.person_id ORDER BY d.id DESC`);
    if (f.status) list = list.filter((d) => d.status === f.status);
    if (f.person_id) list = list.filter((d) => d.person_id === Number(f.person_id));
    list = list.filter((d) => has(o.q, d.body, d.person_name));
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

  function touches(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = rows(ctx, `SELECT t.*, p.name AS person_name FROM touches t JOIN people p ON p.id = t.person_id ORDER BY t.happened_at DESC, t.id DESC`);
    for (const k of ["person_id", "opportunity_id", "project_id"]) if (f[k]) list = list.filter((t) => t[k] === Number(f[k]));
    list = list.filter((t) => has(o.q, t.summary, t.person_name));
    return page(list, o.limit, o.offset);
  }

  function comments(o: ListOpts): Rows {
    const f = o.filter ?? {};
    const list = listThreads(ctx, {
      target_type: f.target_type, target_id: f.target_id ? Number(f.target_id) : undefined,
      unanswered: bool(f.unanswered), last_by: f.last_by,
      resolved: f.resolved === "all" ? "all" : bool(f.resolved),
    }).filter((t) => has(o.q, t.last_body, t.target_label));
    return page(list, o.limit, o.offset);
  }

  function settings(): Rows {
    const s = settingsService(ctx).all();
    const list = Object.entries(s).map(([key, value]) => ({ key, value: typeof value === "object" ? JSON.stringify(value) : value }));
    return { rows: list, total: list.length };
  }

  const LISTS: Record<Exclude<RecordType, "setting"> | "setting", (o: ListOpts) => Rows> = {
    person: people, company: companies, source: sources, opportunity: opportunities, project: projects,
    task: tasks, draft: drafts, payment: payments, touch: touches, comment: comments, setting: settings,
  };

  function find(type: RecordType, o: ListOpts = {}) {
    const r = LISTS[type]({ ...o, limit: o.limit ?? 20, offset: o.offset ?? 0 });
    return r;
  }

  // ---------- tek kayıt ----------
  const COMMENT_TYPES = { person: "person", company: "company", opportunity: "opportunity", project: "project", task: "task", draft: "draft", payment: "payment" } as const;

  const relatedFor: Record<string, string[]> = {
    person: ["touches", "tasks", "opportunities", "projects", "comments", "referrals", "drafts"],
    company: ["people"],
    opportunity: ["touches", "tasks", "comments", "drafts"],
    project: ["payments", "tasks", "touches", "comments", "drafts"],
    payment: ["comments"], task: ["comments"], draft: ["comments"],
  };

  /** Tek kayıt + isteğe bağlı ilişkili kayıtlar (with). Her ilişkili liste en fazla 10 satır. */
  function get(type: RecordType, id: number, withRel: string[] = []) {
    const own = (r: any) => (r === undefined ? undefined : r);
    let rowData: any;
    switch (type) {
      case "person": rowData = own(find("person", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "company": rowData = own(find("company", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "source": rowData = own(find("source", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "opportunity": rowData = own(find("opportunity", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "project": rowData = own(find("project", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "task": rowData = own(find("task", { filter: { all: true }, limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "draft": rowData = own(find("draft", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "payment": rowData = own(find("payment", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "touch": rowData = own(find("touch", { limit: 100000 }).rows.find((p) => p.id === id)); break;
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
    const allowed = relatedFor[type] ?? [];
    const cap = (r: Rows) => r.rows.slice(0, 10);
    for (const name of withRel) {
      if (!allowed.includes(name)) throw new FFError("validation", `${type} için geçerli ilişkiler: ${allowed.join(", ") || "yok"}`);
      const by = { [`${type}_id`]: id };
      switch (name) {
        case "touches": related.touches = cap(touches({ filter: by, limit: 10 })); break;
        case "tasks": related.tasks = cap(tasks({ filter: by, limit: 10 })); break;
        case "opportunities": related.opportunities = cap(opportunities({ filter: by, limit: 10 })); break;
        case "projects": related.projects = cap(projects({ filter: by, limit: 10 })); break;
        case "payments": related.payments = cap(payments({ filter: by, limit: 10 })); break;
        case "drafts": related.drafts = cap(drafts({ filter: by, limit: 10 })); break;
        case "people": related.people = cap(people({ filter: { company_id: id }, limit: 10 })); break;
        case "referrals": related.referrals = cap(people({ filter: { referred_by_id: id }, limit: 10 })); break;
        case "comments": related.comments = listThreads(ctx, { target_type: COMMENT_TYPES[type as keyof typeof COMMENT_TYPES], target_id: id, resolved: "all" }).slice(0, 10); break;
      }
    }
    // açık yorum konusu sayısı (Claude cevapsız yorumu fark etsin)
    let comments_open: number | undefined;
    if (type in COMMENT_TYPES) {
      comments_open = listThreads(ctx, { target_type: COMMENT_TYPES[type as keyof typeof COMMENT_TYPES], target_id: id }).length;
    }
    return { type, id, row: rowData, related, comments_open };
  }

  /** Kişi / fırsat / proje olayları: son N olay, eskiden yeniye */
  function timeline(type: "person" | "opportunity" | "project", id: number, limit = 20) {
    const col = { person: "person_id", opportunity: "opportunity_id", project: "project_id" }[type];
    if (!col) throw new FFError("validation", "timeline için type: person, opportunity ya da project");
    const list = rows(ctx, `SELECT * FROM events WHERE ${col} = ? ORDER BY id DESC LIMIT ?`, id, limit).reverse();
    return list.map((e) => ({ ...e, data: e.data ? JSON.parse(e.data) : null }));
  }

  return { find, get, timeline, people, opportunities, projects, tasks, drafts, payments, touches, comments, companies, sources };
}
