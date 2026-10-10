import { OPP_STAGES, OPEN_OPP_STAGES, type RecordType } from "../constants";
import { addDays } from "../dates";
import { FFError, norm, page, row, rows, type Ctx, type ListOpts } from "../context";
import { bool, companiesList, companyCard as buildCompanyCard, COMPANY_TOUCHES, has, peopleList, tagsList } from "./directory";
import { listThreads, threadOf } from "./comments";
import { paymentStatus } from "./payments";
import { settingsService } from "./settings";
import { channelSummary, networkSettings, referralValues } from "./network";
import { sectorIds } from "./sectors";
import { trashList } from "./trash";
import { requireRow } from "./shared";
import { postStats } from "./posts";
import { templateStats } from "./templates";
import { ideaPeople, ideaStats } from "./ideas";

type Rows = { rows: any[]; total: number };

export function queriesService(ctx: Ctx) {
  const today = () => ctx.clock.today();

  // ---------- listeler ----------
  const people = (o: ListOpts) => peopleList(ctx, o);
  const companies = (o: ListOpts) => companiesList(ctx, o);
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
      const nt = row(ctx, `SELECT id, title, due_date, assignee, created_by FROM tasks WHERE project_id = ? AND done_at IS NULL ORDER BY (due_date IS NULL), due_date, id LIMIT 1`, p.id);
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

  function touches(o: ListOpts): Rows {
    const f = o.filter ?? {};
    const scope = f.company_scope ? `WHERE ${COMPANY_TOUCHES}` : "";
    let list = rows(ctx, `SELECT t.*, p.name AS person_name, COALESCE(c.name, pc.name) AS company_name, COALESCE(p.name, c.name, t.contact) AS to_name,
        op.title AS opportunity_title, i.title AS idea_title
      FROM touches t LEFT JOIN people p ON p.id = t.person_id LEFT JOIN companies c ON c.id = t.company_id LEFT JOIN companies pc ON pc.id = p.company_id
      LEFT JOIN opportunities op ON op.id = t.opportunity_id LEFT JOIN ideas i ON i.id = t.idea_id ${scope} ORDER BY t.happened_at DESC, t.id DESC`,
      ...(f.company_scope ? [Number(f.company_scope), Number(f.company_scope)] : []))
      .map(({ contact_key: _k, ...t }) => ({ ...t, expects_reply: !!t.expects_reply }));
    if (bool(f.loose)) list = list.filter((t) => !t.person_id && !t.company_id);
    if (f.channel) list = list.filter((t) => t.channel === f.channel);
    for (const k of ["person_id", "company_id", "opportunity_id", "project_id", "idea_id"]) if (f[k]) list = list.filter((t) => t[k] === Number(f[k]));
    list = list.filter((t) => has(o.q, t.summary, t.to_name, t.contact));
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
  function posts(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = postStats(ctx);
    if (f.platform) list = list.filter((p) => p.platform === f.platform);
    if (bool(f.refresh_due)) list = list.filter((p) => p.refresh_due);
    if (f.idea_id) list = list.filter((p) => p.idea_id === Number(f.idea_id));
    list = list.filter((p) => has(o.q, p.title, p.url, p.body, p.notes));
    return page(list, o.limit, o.offset);
  }

  function templates(o: ListOpts): Rows {
    const f = o.filter ?? {};
    let list = templateStats(ctx);
    if (f.kind) list = list.filter((t) => t.kind === f.kind);
    if (f.channel) list = list.filter((t) => !t.channel || t.channel === f.channel);
    if (f.sector) {
      const sid = /^\d+$/.test(String(f.sector)) ? Number(f.sector)
        : rows<{ id: number; name: string }>(ctx, "SELECT id, name FROM sectors").find((x) => norm(x.name) === norm(String(f.sector)))?.id;
      const ids = sid ? sectorIds(ctx, sid) : [];
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
      const sid = /^\d+$/.test(String(f.sector)) ? Number(f.sector)
        : rows<{ id: number; name: string }>(ctx, "SELECT id, name FROM sectors").find((x) => norm(x.name) === norm(String(f.sector)))?.id;
      const ids = sid ? sectorIds(ctx, sid) : [];
      list = list.filter((i) => i.sectors.some((s: { id: number }) => ids.includes(s.id)));
    }
    list = list.filter((i) => has(o.q, i.title, i.problem, i.notes));
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
    person: people, company: companies, source: sources, opportunity: opportunities, project: projects,
    task: tasks, draft: drafts, payment: payments, touch: touches, comment: comments, setting: settings,
    sector: sectors, note: notes, post: posts, template: templates, idea: ideas, interest: interests, tag: tags,
    trash: (o) => {
      const t = (o.filter ?? {}).type;
      return page(trashList(ctx).filter((x) => (!t || x.type === t) && has(o.q, x.label)), o.limit, o.offset);
    },
  };

  function find(type: RecordType, o: ListOpts = {}) {
    const r = LISTS[type]({ ...o, limit: o.limit ?? 20, offset: o.offset ?? 0 });
    return r;
  }

  // ---------- tek kayıt ----------
  const COMMENT_TYPES = { person: "person", company: "company", opportunity: "opportunity", project: "project", task: "task", draft: "draft", payment: "payment", post: "post", idea: "idea" } as const;

  const relatedFor: Record<string, string[]> = {
    person: ["touches", "tasks", "opportunities", "projects", "comments", "referrals", "drafts", "notes", "channels"],
    company: ["people", "touches", "opportunities", "drafts", "comments", "channels"],
    opportunity: ["touches", "tasks", "comments", "drafts"],
    project: ["payments", "tasks", "touches", "comments", "drafts"],
    payment: ["comments"], task: ["comments"], draft: ["comments"],
    post: ["people", "comments"], idea: ["people", "touches", "posts", "comments"], template: ["drafts"],
  };

  /** Tek kayıt + isteğe bağlı ilişkili kayıtlar (with). Her ilişkili liste en fazla relLimit (varsayılan 10) satır. */
  function get(type: RecordType, id: number, withRel: string[] = [], relLimit = 10) {
    const own = (r: any) => (r === undefined ? undefined : r);
    let rowData: any;
    switch (type) {
      case "person": rowData = own(find("person", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "company": rowData = own(find("company", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "source": rowData = own(find("source", { filter: { all: true }, limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "opportunity": rowData = own(find("opportunity", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "project": rowData = own(find("project", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "task": rowData = own(find("task", { filter: { all: true }, limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "draft": rowData = own(find("draft", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "payment": rowData = own(find("payment", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "touch": rowData = own(find("touch", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "sector": rowData = own(find("sector", { filter: { all: true }, limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "tag": rowData = own(find("tag", { filter: { all: true }, limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "trash": throw new FFError("validation", "çöp kutusu için find(type: trash) kullan");
      case "note": rowData = own(find("note", { limit: 100000 }).rows.find((p) => p.id === id)); break;
      case "post": rowData = own(postStats(ctx).find((p) => p.id === id)); break;
      case "template": rowData = own(templateStats(ctx).find((p) => p.id === id)); break;
      case "idea": rowData = own(ideaStats(ctx).find((p) => p.id === id)); break;
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
    const allowed = relatedFor[type] ?? [];
    const n = Math.min(Math.max(1, relLimit), 200);
    const cap = (r: Rows) => r.rows.slice(0, n);
    for (const name of withRel) {
      if (!allowed.includes(name)) throw new FFError("validation", `${type} için geçerli ilişkiler: ${allowed.join(", ") || "yok"}`);
      const by = type === "company" ? { company_scope: id } : { [`${type}_id`]: id };
      switch (name) {
        case "touches": related.touches = cap(touches({ filter: by, limit: n })); break;
        case "tasks": related.tasks = cap(tasks({ filter: by, limit: n })); break;
        case "opportunities": related.opportunities = cap(opportunities({ filter: type === "company" ? { company_id: id } : by, limit: n })); break;
        case "projects": related.projects = cap(projects({ filter: by, limit: n })); break;
        case "payments": related.payments = cap(payments({ filter: by, limit: n })); break;
        case "drafts": related.drafts = cap(drafts({ filter: by, limit: n })); break;
        case "people":
          related.people = type === "idea" ? ideaPeople(ctx, id).slice(0, n)
            : type === "post" ? cap(people({ filter: { post_id: id }, limit: n }))
            : cap(people({ filter: { company_id: id }, limit: n }));
          break;
        case "posts": related.posts = cap(posts({ filter: { idea_id: id }, limit: n })); break;
        case "referrals": related.referrals = cap(people({ filter: { referred_by_id: id }, limit: n })); break;
        case "notes": related.notes = cap(notes({ filter: { person_id: id }, limit: n })); break;
        case "channels": related.channels = type === "company" ? companyCard(id).channels : channelSummary(ctx, id, rowData.awaiting ? { awaiting: rowData.awaiting } as any : undefined); break;
        case "comments": related.comments = listThreads(ctx, { target_type: COMMENT_TYPES[type as keyof typeof COMMENT_TYPES], target_id: id, resolved: "all" }).slice(0, n); break;
      }
    }
    // açık yorum konusu sayısı (Claude cevapsız yorumu fark etsin)
    let comments_open: number | undefined;
    if (type in COMMENT_TYPES) {
      comments_open = listThreads(ctx, { target_type: COMMENT_TYPES[type as keyof typeof COMMENT_TYPES], target_id: id }).length;
    }
    if (type === "person") rowData = { ...rowData, referral_value: referralValues(ctx).find((r) => r.person_id === id) ?? null };
    return { type, id, row: rowData, related, comments_open };
  }

  /**
   * Kişi kartı tek istekte: kişi + sektör + kanal özeti + temaslar + notlar + yorum konuları (mesajlarıyla)
   * + referans eden/tanıttıkları + referans değeri + fırsat/proje + bekleyen taslaklar.
   */
  function personCard(id: number) {
    const person = people({ limit: 100000 }).rows.find((p) => p.id === id);
    if (!person) throw new FFError("not_found", `kişi #${id} bulunamadı`);
    const refs = referralValues(ctx);
    const allTouches = touches({ filter: { person_id: id }, limit: 200 });
    return {
      row: person,
      channels: channelSummary(ctx, id, { awaiting: person.awaiting } as any),
      touches: allTouches,
      notes: notes({ filter: { person_id: id }, limit: 200 }).rows,
      threads: listThreads(ctx, { target_type: "person", target_id: id, resolved: "all", messages: true }),
      referrer: person.referred_by_id ? { id: person.referred_by_id, name: person.referred_by_name } : null,
      referrals: people({ filter: { referred_by_id: id }, limit: 200 }).rows.map((r) => {
        const v = refs.find((x) => x.person_id === r.id);
        const own = row(ctx, "SELECT COUNT(*) AS opps, COALESCE(SUM(stage = 'kazanildi'), 0) AS won FROM opportunities WHERE person_id = ?", r.id);
        return { id: r.id, name: r.name, company_name: r.company_name, tags: r.tags, sector_path: r.sector_path, opps: own?.opps ?? 0, won: own?.won ?? 0, network: v?.network ?? 0 };
      }),
      referral_value: refs.find((r) => r.person_id === id) ?? null,
      opportunities: opportunities({ filter: { person_id: id }, limit: 100 }).rows,
      projects: projects({ filter: { person_id: id }, limit: 100 }).rows,
      drafts: drafts({ filter: { person_id: id, status: "bekliyor" }, limit: 20 }).rows,
      // Paket 2: kişiyi getiren paylaşım ve anlatılan fikirler
      post: person.post_id ? postStats(ctx).find((x) => x.id === person.post_id) ?? null : null,
      ideas: ideaPeople(ctx, undefined, id),
    };
  }

  /** Firma kartı: çalışanlar, firmaya ve çalışanlarına temaslar, çalışanların fırsatları, bekleyen taslaklar, yorumlar */
  function companyCard(id: number) {
    return {
      ...buildCompanyCard(ctx, id, { people, touches, opportunities, drafts }),
      threads: listThreads(ctx, { target_type: "company", target_id: id, resolved: "all", messages: true }),
    };
  }

  /** Kişi / fırsat / proje olayları: son N olay, eskiden yeniye */
  function timeline(type: "person" | "opportunity" | "project", id: number, limit = 20) {
    const col = { person: "person_id", opportunity: "opportunity_id", project: "project_id" }[type];
    if (!col) throw new FFError("validation", "timeline için type: person, opportunity ya da project");
    const list = rows(ctx, `SELECT * FROM events WHERE ${col} = ? ORDER BY id DESC LIMIT ?`, id, limit).reverse();
    return list.map((e) => ({ ...e, data: e.data ? JSON.parse(e.data) : null }));
  }

  return { find, get, timeline, personCard, companyCard, sectors, tags, notes, posts, templates, ideas, interests, people, opportunities, projects, tasks, drafts, payments, touches, comments, companies, sources };
}
