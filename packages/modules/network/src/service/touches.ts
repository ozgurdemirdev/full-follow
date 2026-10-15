import { eq } from "drizzle-orm";
import {
  announceTrashed, Bin, bool, COMPANY_TOUCHES, contactKey, eventLink as link, FFError, has, isColdEmail, page, parse, requireRow, resolveSubject, rows, sameSide, schema, stamp, truncate,
  writeEvent as emit, type Ctx, type ListOpts, type Q, type TouchInput, type TouchListRow, type TouchRecord,
} from "@fullfollow/core";
import { m } from "../messages";
import { EVENT_SUMMARY_LENGTH, EVENT_SUMMARY_SHORT } from "./constants";
import { suggestMatches } from "./match";
import { adoptInput, touchCreate, touchUpdate } from "./schemas";
import { bumpContactStatus, statusOfTouch } from "./status";

const { touches } = schema;

/** The idea a touch is about comes from the ideas module (a link to it is refused while it is not installed) */
function requireIdea(ctx: Ctx, id: number): void {
  const ideas = ctx.mod("ideas");
  if (!ideas) throw new FFError("validation", m.error.ideaModuleMissing(id));
  if (!ideas.ref(id)) throw new FFError("not_found", m.error.ideaNotFound(id));
}

/**
 * Temas kaydeder; muhatap kişi, firma ya da sadece adres olabilir (resolveSubject).
 * Kişinin ve firmasının temas durumu ilerler (yazıldı → cevap geldi → görüşüldü); bunu people ve companies modülleri yapar.
 * Sonra `touch.created` olayı yayılır: gönderim uyarıları, fikir ilgisi ve fırsat aşaması bu olayı dinleyenlerin işidir.
 * Fırsat verilmediyse kişinin tek açık fırsatı varsa ona bağlanır.
 */
export function insertTouch(q: Q, ctx: Ctx, d: TouchInput): { row: TouchRecord; effects: string[] } {
  const s = resolveSubject(ctx, d);
  let oppId = d.opportunity_id ?? null;
  if (!s.person_id && (d.idea_id || (!s.company_id && (oppId || d.project_id)))) throw new FFError("validation", m.error.linkOwners);
  // opportunities come from the pipeline module, projects from the projects module (a link to one that is not installed is refused)
  const pipeline = ctx.mod("pipeline");
  if (oppId) {
    if (!pipeline) throw new FFError("validation", m.error.opportunityModuleMissing(oppId));
    const o = pipeline.opportunities.ref(oppId);
    if (!o) throw new FFError("not_found", m.error.opportunityNotFound(oppId));
    if (!sameSide(ctx, o.person_id, s)) throw new FFError("validation", m.error.opportunityNotTheirs(oppId));
  } else if (s.person_id && !d.project_id) {
    // proje hakkındaki temas satış fırsatını ilerletmesin; sadece serbest temas tek açık fırsata bağlanır
    const open = pipeline?.opportunities.openIdsOf(s.person_id) ?? [];
    if (open.length === 1) oppId = open[0];
  }
  if (d.project_id) {
    const projects = ctx.mod("projects");
    if (!projects) throw new FFError("validation", m.error.projectModuleMissing(d.project_id));
    const p = projects.projects.ref(d.project_id);
    if (!p) throw new FFError("not_found", m.error.projectNotFound(d.project_id));
    if (!sameSide(ctx, p.person_id, s)) throw new FFError("validation", m.error.projectNotTheirs(d.project_id));
  }
  if (d.idea_id) requireIdea(ctx, d.idea_id);

  const cold = isColdEmail(ctx, d, s);
  const r = q.insert(touches).values({
    ...s, opportunity_id: oppId, project_id: d.project_id ?? null,
    channel: d.channel, direction: d.direction, kind: d.kind, summary: d.summary, outcome: d.outcome ?? null,
    happened_at: d.happened_at ?? ctx.clock.now(),
    // giden mesaj varsayılan olarak cevap bekler (cevap bekleyenler listesi); arama/görüşme/gelen beklemez
    expects_reply: d.direction === "giden" && (d.expects_reply ?? d.kind === "mesaj"),
    draft_id: d.draft_id ?? null, idea_id: d.idea_id ?? null, ...stamp(ctx),
  }).returning().get();
  const who = s.person_id ? "" : s.company_id ? ` → ${requireRow(ctx, "companies", s.company_id).name}` : ` → ${s.contact}`;
  emit(q, ctx, {
    type: "touch.created", ...link(ctx, { person_id: s.person_id, opportunity_id: oppId, project_id: d.project_id }),
    summary: m.event.created(d.direction === "giden" ? m.event.outgoing : m.event.incoming, d.kind, d.channel, who, truncate(d.summary, EVENT_SUMMARY_LENGTH)),
    data: { touch_id: r.id, channel: d.channel, direction: d.direction, company_id: s.company_id ?? undefined },
  });

  const effects: string[] = bumpContactStatus(ctx, s, statusOfTouch(d));
  effects.push(...ctx.emit("touch.created", { touch: r as TouchRecord, subject: s, cold, input: { channel: d.channel, direction: d.direction, kind: d.kind, idea_id: d.idea_id } }));
  return { row: r as TouchRecord, effects };
}

type Selected = Omit<TouchListRow, "suggested_match"> & { contact_key: string | null };

/** Touch rows with the names they hang on (and their address key); `where` narrows to one touch (`t.id = ?`) or to a company's scope */
function selectTouches(ctx: Ctx, where = "", ...params: unknown[]): Selected[] {
  const list = rows(ctx, `SELECT t.*, p.name AS person_name, COALESCE(c.name, pc.name) AS company_name, COALESCE(p.name, c.name, t.contact) AS to_name,
      i.title AS idea_title
    FROM touches t LEFT JOIN people p ON p.id = t.person_id LEFT JOIN companies c ON c.id = t.company_id LEFT JOIN companies pc ON pc.id = p.company_id
    LEFT JOIN ideas i ON i.id = t.idea_id ${where} ORDER BY t.happened_at DESC, t.id DESC`, ...params);
  // the opportunity titles come from the pipeline module (null without it)
  const titles = ctx.mod("pipeline")?.opportunities.titles(list.flatMap((t) => (t.opportunity_id ? [t.opportunity_id as number] : [])));
  return list.map((t) => ({ ...t, opportunity_title: titles?.get(t.opportunity_id) ?? null, expects_reply: !!t.expects_reply }));
}

const isLoose = (t: { person_id: number | null; company_id: number | null }) => !t.person_id && !t.company_id;

/** The rows as listed: the address key leaves, and a loose touch gets the record its address points at (one lookup for the whole list) */
function present(ctx: Ctx, list: Selected[]): TouchListRow[] {
  const matches = suggestMatches(ctx, list.flatMap((t) => (isLoose(t) && t.contact_key ? [t.contact_key] : [])));
  return list.map(({ contact_key, ...t }) => ({ ...t, suggested_match: isLoose(t) && contact_key ? matches.get(contact_key) ?? null : null }));
}

/** A loose touch joins the person or company its address belongs to: the status of the record moves like a new touch's, an event is written, the drafts of that address follow */
function moveLoose(q: Q, ctx: Ctx, cur: TouchRecord, owner: { person_id?: number; company_id?: number }): string[] {
  if (!isLoose(cur)) throw new FFError("rule", m.error.alreadyLinked(cur.id));
  const personal = owner.person_id !== undefined;
  const target = personal ? requireRow(ctx, "people", owner.person_id!) : requireRow(ctx, "companies", owner.company_id!);
  q.update(touches).set({ ...owner, updated_at: ctx.clock.now() }).where(eq(touches.id, cur.id)).run();
  emit(q, ctx, {
    type: "touch.adopted", ...link(ctx, { person_id: owner.person_id }),
    summary: m.event.adopted(personal, target.name, cur.contact, truncate(cur.summary, EVENT_SUMMARY_SHORT)),
    data: { touch_id: cur.id, contact: cur.contact, ...owner },
  });
  if (cur.contact_key) ctx.mod("drafts")?.adoptLoose(owner, [cur.contact_key]);
  return bumpContactStatus(ctx, owner, statusOfTouch(cur));
}

export function touchesService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(touchCreate, input);
    return ctx.db.transaction((tx) => insertTouch(tx, ctx, d));
  }

  /**
   * Özet, sonuç, kanal, tür, tarih ve cevap bekleme bayrağı düzeltilir; yön ve fırsat değişmez (aşama kuralı tekrar çalışmasın).
   * Muhatap sadece kişisiz adres temasında değişir: `person_id` ya da `company_id` onu o kayda bağlar.
   */
  function update(id: number, input: unknown) {
    const { person_id, company_id, ...d } = parse(touchUpdate, input);
    const owner = person_id ? { person_id } : company_id ? { company_id } : null;
    return ctx.db.transaction((tx) => {
      let cur = requireRow<TouchRecord>(ctx, "touches", id);
      if (d.expects_reply && cur.direction !== "giden") throw new FFError("validation", m.error.onlyOutgoingWaits);
      const moved = owner ? moveLoose(tx, ctx, cur, owner) : [];
      if (owner) cur = requireRow<TouchRecord>(ctx, "touches", id);
      if (!Object.keys(d).length) return { row: cur, effects: moved };
      if (d.idea_id) {
        if (!cur.person_id) throw new FFError("validation", m.error.ideaOnlyPerson);
        requireIdea(ctx, d.idea_id);
      }
      tx.update(touches).set({ ...d, updated_at: ctx.clock.now() }).where(eq(touches.id, id)).run();
      const what = d.expects_reply === false ? m.event.noReply : d.expects_reply ? m.event.waitsReply : m.event.edited;
      emit(tx, ctx, { type: "touch.updated", ...link(ctx, cur), summary: m.event.updated(what, truncate(d.summary ?? cur.summary, EVENT_SUMMARY_SHORT)), data: { touch_id: id } });
      const row = requireRow<TouchRecord>(ctx, "touches", id);
      const effects = [...moved, ...ctx.emit("touch.updated", { touch: row, changes: d })];
      if (d.kind) effects.push(...bumpContactStatus(ctx, cur, statusOfTouch({ direction: cur.direction, kind: d.kind })));
      return { row, effects };
    });
  }

  /**
   * Moves every loose touch that has a suggested match to it, in one transaction (the effects are the count and the status moves).
   * `{ contact }` limits it to the touches written with that address.
   */
  function adoptSuggested(input: unknown = {}) {
    const { contact } = parse(adoptInput, input ?? {});
    return ctx.db.transaction((tx) => {
      const key = contact ? contactKey(contact) : null;
      const loose = rows<TouchRecord>(ctx, `SELECT * FROM touches WHERE person_id IS NULL AND company_id IS NULL AND contact_key IS NOT NULL${key ? " AND contact_key = ?" : ""}`, ...(key ? [key] : []));
      const matches = suggestMatches(ctx, loose.map((t) => t.contact_key!));
      const effects: string[] = [];
      let adopted = 0;
      for (const t of loose) {
        const match = matches.get(t.contact_key!);
        if (!match) continue;
        effects.push(...moveLoose(tx, ctx, t, match.type === "person" ? { person_id: match.id } : { company_id: match.id }));
        adopted++;
      }
      return { adopted, effects: adopted ? [m.adopted(adopted), ...effects] : effects };
    });
  }

  function remove(id: number) {
    const cur = requireRow<TouchRecord>(ctx, "touches", id);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      // the ideas module empties the interest rows that point at the touch
      announceTrashed(ctx, bin, "touch", id);
      bin.take("touches", "id = ?", id);
      bin.commit(tx, "touch", id, m.trashTouch(truncate(cur.summary, EVENT_SUMMARY_LENGTH)));
      emit(tx, ctx, { type: "touch.deleted", ...link(ctx, cur), summary: m.event.deleted(truncate(cur.summary, EVENT_SUMMARY_LENGTH)), data: { touch_id: id } });
      return { effects: [] as string[], trash: { type: "touch", id } };
    });
  }

  /** Filters: loose (no person or company), channel, person_id, company_id, opportunity_id, project_id, idea_id, company_scope (the company and its people) */
  function list(o: ListOpts) {
    const f = o.filter ?? {};
    let list = f.company_scope ? selectTouches(ctx, `WHERE ${COMPANY_TOUCHES}`, Number(f.company_scope), Number(f.company_scope)) : selectTouches(ctx);
    if (bool(f.loose)) list = list.filter(isLoose);
    if (f.channel) list = list.filter((t) => t.channel === f.channel);
    for (const k of ["person_id", "company_id", "opportunity_id", "project_id", "idea_id"] as const) if (f[k]) list = list.filter((t) => t[k] === Number(f[k]));
    list = list.filter((t) => has(o.q, t.summary, t.to_name, t.contact));
    const shown = page(list, o.limit, o.offset);
    return { rows: present(ctx, shown.rows), total: shown.total };
  }

  const get = (id: number): TouchListRow | undefined => present(ctx, selectTouches(ctx, "WHERE t.id = ?", id))[0];

  return { create, insert: (q: Q, d: TouchInput) => insertTouch(q, ctx, d), update, adoptSuggested, remove, list, get };
}
