import { eq } from "drizzle-orm";
import {
  Bin, bool, COMPANY_TOUCHES, eventLink as link, FFError, has, isColdEmail, page, parse, requireRow, resolveSubject, rows, sameSide, schema, stamp, truncate,
  writeEvent as emit, type Ctx, type ListOpts, type Q, type TouchInput, type TouchListRow, type TouchRecord,
} from "@fullfollow/core";
import { touchCreate, touchUpdate } from "./schemas";
import { bumpContactStatus, statusOfTouch } from "./status";

const { touches } = schema;

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
  // TODO(modules): opportunities and projects through ctx.mod("pipeline") / ctx.mod("projects") (raw table reads for now)
  if (oppId) {
    const o = requireRow(ctx, "opportunities", oppId);
    if (!sameSide(ctx, o.person_id, s)) throw new FFError("validation", `fırsat #${oppId} bu kişiye ya da firmasına ait değil`);
  } else if (s.person_id && !d.project_id) {
    // proje hakkındaki temas satış fırsatını ilerletmesin; sadece serbest temas tek açık fırsata bağlanır
    const open = rows<{ id: number }>(ctx, "SELECT id FROM opportunities WHERE person_id = ? AND stage IN ('bulundu','temas','cevap','gorusme','teklif')", s.person_id);
    if (open.length === 1) oppId = open[0].id;
  }
  if (d.project_id) {
    const p = requireRow(ctx, "projects", d.project_id);
    if (!sameSide(ctx, p.person_id, s)) throw new FFError("validation", `proje #${d.project_id} bu kişiye ya da firmasına ait değil`);
  }
  // TODO(modules): ideas through ctx.mod("ideas")
  if (d.idea_id) requireRow(ctx, "ideas", d.idea_id);

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
  return rows(ctx, `SELECT t.*, p.name AS person_name, COALESCE(c.name, pc.name) AS company_name, COALESCE(p.name, c.name, t.contact) AS to_name,
      op.title AS opportunity_title, i.title AS idea_title
    FROM touches t LEFT JOIN people p ON p.id = t.person_id LEFT JOIN companies c ON c.id = t.company_id LEFT JOIN companies pc ON pc.id = p.company_id
    LEFT JOIN opportunities op ON op.id = t.opportunity_id LEFT JOIN ideas i ON i.id = t.idea_id ${where} ORDER BY t.happened_at DESC, t.id DESC`, ...params)
    .map(({ contact_key: _k, ...t }) => ({ ...t, expects_reply: !!t.expects_reply }));
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
        requireRow(ctx, "ideas", d.idea_id);
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
      // TODO(modules): the ideas module unlinks its interest rows when it hears `record.trashed` for a touch
      bin.unlink("idea_people", "touch_id", id);
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
