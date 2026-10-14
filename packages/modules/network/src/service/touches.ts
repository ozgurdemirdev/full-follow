import { eq } from "drizzle-orm";
import {
  announceTrashed, Bin, bool, COMPANY_TOUCHES, eventLink as link, FFError, has, isColdEmail, page, parse, requireRow, resolveSubject, rows, sameSide, schema, stamp, truncate,
  writeEvent as emit, type Ctx, type ListOpts, type Q, type TouchInput, type TouchListRow, type TouchRecord,
} from "@fullfollow/core";
import { touchCreate, touchUpdate } from "./schemas";
import { bumpContactStatus, statusOfTouch } from "./status";

const { touches } = schema;

/** The idea a touch is about comes from the ideas module (a link to it is refused while it is not installed) */
function requireIdea(ctx: Ctx, id: number): void {
  const ideas = ctx.mod("ideas");
  if (!ideas) throw new FFError("validation", `fikir verildi (#${id}) ama "ideas" modülü kurulu değil`);
  if (!ideas.ref(id)) throw new FFError("not_found", `fikir #${id} bulunamadı`);
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
  if (!s.person_id && (d.idea_id || (!s.company_id && (oppId || d.project_id)))) throw new FFError("validation", "fikir bağlantısı sadece kişiye, fırsat ve proje bağlantısı kişiye ya da firmaya yazılan temasta olur");
  // opportunities come from the pipeline module, projects from the projects module (a link to one that is not installed is refused)
  const pipeline = ctx.mod("pipeline");
  if (oppId) {
    if (!pipeline) throw new FFError("validation", `fırsat verildi (#${oppId}) ama "pipeline" modülü kurulu değil`);
    const o = pipeline.opportunities.ref(oppId);
    if (!o) throw new FFError("not_found", `fırsat #${oppId} bulunamadı`);
    if (!sameSide(ctx, o.person_id, s)) throw new FFError("validation", `fırsat #${oppId} bu kişiye ya da firmasına ait değil`);
  } else if (s.person_id && !d.project_id) {
    // proje hakkındaki temas satış fırsatını ilerletmesin; sadece serbest temas tek açık fırsata bağlanır
    const open = pipeline?.opportunities.openIdsOf(s.person_id) ?? [];
    if (open.length === 1) oppId = open[0];
  }
  if (d.project_id) {
    const projects = ctx.mod("projects");
    if (!projects) throw new FFError("validation", `proje verildi (#${d.project_id}) ama "projects" modülü kurulu değil`);
    const p = projects.projects.ref(d.project_id);
    if (!p) throw new FFError("not_found", `proje #${d.project_id} bulunamadı`);
    if (!sameSide(ctx, p.person_id, s)) throw new FFError("validation", `proje #${d.project_id} bu kişiye ya da firmasına ait değil`);
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
    summary: `${d.direction === "giden" ? "Giden" : "Gelen"} ${d.kind} (${d.channel})${who}: ${truncate(d.summary, 60)}`,
    data: { touch_id: r.id, channel: d.channel, direction: d.direction, company_id: s.company_id ?? undefined },
  });

  const effects: string[] = bumpContactStatus(ctx, s, statusOfTouch(d));
  effects.push(...ctx.emit("touch.created", { touch: r as TouchRecord, subject: s, cold, input: { channel: d.channel, direction: d.direction, kind: d.kind, idea_id: d.idea_id } }));
  return { row: r as TouchRecord, effects };
}

/** Touch rows with the names they hang on; `where` narrows to one touch (`t.id = ?`) or to a company's scope */
function selectTouches(ctx: Ctx, where = "", ...params: unknown[]): TouchListRow[] {
  const list = rows(ctx, `SELECT t.*, p.name AS person_name, COALESCE(c.name, pc.name) AS company_name, COALESCE(p.name, c.name, t.contact) AS to_name,
      i.title AS idea_title
    FROM touches t LEFT JOIN people p ON p.id = t.person_id LEFT JOIN companies c ON c.id = t.company_id LEFT JOIN companies pc ON pc.id = p.company_id
    LEFT JOIN ideas i ON i.id = t.idea_id ${where} ORDER BY t.happened_at DESC, t.id DESC`, ...params);
  // the opportunity titles come from the pipeline module (null without it)
  const titles = ctx.mod("pipeline")?.opportunities.titles(list.flatMap((t) => (t.opportunity_id ? [t.opportunity_id as number] : [])));
  return list.map(({ contact_key: _k, ...t }) => ({ ...t, opportunity_title: titles?.get(t.opportunity_id) ?? null, expects_reply: !!t.expects_reply }));
}

export function touchesService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(touchCreate, input);
    return ctx.db.transaction((tx) => insertTouch(tx, ctx, d));
  }

  /** Özet, sonuç, kanal, tür, tarih ve cevap bekleme bayrağı düzeltilir; muhatap/fırsat/yön değişmez (aşama kuralı tekrar çalışmasın) */
  function update(id: number, input: unknown) {
    const d = parse(touchUpdate, input);
    return ctx.db.transaction((tx) => {
      const cur = requireRow<TouchRecord>(ctx, "touches", id);
      if (d.expects_reply && cur.direction !== "giden") throw new FFError("validation", "sadece giden temas cevap bekleyebilir");
      if (!Object.keys(d).length) return { row: cur, effects: [] as string[] };
      if (d.idea_id) {
        if (!cur.person_id) throw new FFError("validation", "fikir bağlantısı sadece kişiye yazılan temasta olur");
        requireIdea(ctx, d.idea_id);
      }
      tx.update(touches).set({ ...d, updated_at: ctx.clock.now() }).where(eq(touches.id, id)).run();
      const what = d.expects_reply === false ? "cevap beklenmiyor" : d.expects_reply ? "cevap bekleniyor" : "düzenlendi";
      emit(tx, ctx, { type: "touch.updated", ...link(ctx, cur), summary: `Temas ${what}: ${truncate(d.summary ?? cur.summary, 50)}`, data: { touch_id: id } });
      const row = requireRow<TouchRecord>(ctx, "touches", id);
      const effects = ctx.emit("touch.updated", { touch: row, changes: d });
      if (d.kind) effects.push(...bumpContactStatus(ctx, cur, statusOfTouch({ direction: cur.direction, kind: d.kind })));
      return { row, effects };
    });
  }

  function remove(id: number) {
    const cur = requireRow<TouchRecord>(ctx, "touches", id);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      // the ideas module empties the interest rows that point at the touch
      announceTrashed(ctx, bin, "touch", id);
      bin.take("touches", "id = ?", id);
      bin.commit(tx, "touch", id, `Temas: ${truncate(cur.summary, 60)}`);
      emit(tx, ctx, { type: "touch.deleted", ...link(ctx, cur), summary: `Temas silindi: ${truncate(cur.summary, 60)}`, data: { touch_id: id } });
      return { effects: [] as string[], trash: { type: "touch", id } };
    });
  }

  /** Filters: loose (no person or company), channel, person_id, company_id, opportunity_id, project_id, idea_id, company_scope (the company and its people) */
  function list(o: ListOpts) {
    const f = o.filter ?? {};
    let list = f.company_scope ? selectTouches(ctx, `WHERE ${COMPANY_TOUCHES}`, Number(f.company_scope), Number(f.company_scope)) : selectTouches(ctx);
    if (bool(f.loose)) list = list.filter((t) => !t.person_id && !t.company_id);
    if (f.channel) list = list.filter((t) => t.channel === f.channel);
    for (const k of ["person_id", "company_id", "opportunity_id", "project_id", "idea_id"] as const) if (f[k]) list = list.filter((t) => t[k] === Number(f[k]));
    list = list.filter((t) => has(o.q, t.summary, t.to_name, t.contact));
    return page(list, o.limit, o.offset);
  }

  const get = (id: number): TouchListRow | undefined => selectTouches(ctx, "WHERE t.id = ?", id)[0];

  return { create, insert: (q: Q, d: TouchInput) => insertTouch(q, ctx, d), update, remove, list, get };
}
