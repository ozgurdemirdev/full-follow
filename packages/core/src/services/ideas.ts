import { eq } from "drizzle-orm";
import { IDEA_STAGES, label } from "../constants";
import { emit, FFError, parse, row, rows, stamp, type Ctx } from "../context";
import type { Q } from "../db/client";
import { idea_people, idea_sectors, ideas } from "../db/schema";
import { ideaCreate, ideaUpdate, interestSave, interestUpdate } from "../schemas";
import { ensureSector } from "./sectors";
import { requireRow, truncate } from "./shared";
import { Bin } from "./trash";

/** Girdideki `sectors: ["Sağlık > Diş hekimi", "Kafe"]` → sector_ids (eksik sektörler açılır) */
function withSectors(q: Q, ctx: Ctx, input: unknown): unknown {
  if (!input || typeof input !== "object" || !("sectors" in input)) return input;
  const { sectors, ...rest } = input as Record<string, any>;
  if (rest.sector_ids !== undefined) return rest;
  const list = Array.isArray(sectors) ? sectors : String(sectors ?? "").split(",");
  return { ...rest, sector_ids: list.map((s) => ensureSector(q, ctx, typeof s === "number" ? s : String(s).trim())).filter((x): x is number => !!x) };
}

function setSectors(q: Q, ctx: Ctx, ideaId: number, ids: number[]) {
  q.delete(idea_sectors).where(eq(idea_sectors.idea_id, ideaId)).run();
  for (const sid of [...new Set(ids)]) {
    requireRow(ctx, "sectors", sid, "sektör");
    q.insert(idea_sectors).values({ idea_id: ideaId, sector_id: sid, created_at: ctx.clock.now(), created_by: ctx.actor }).run();
  }
}

/**
 * Kişiyi fikre bağlar (yoksa "anlatıldı" olarak). Fikir hakkındaki temas da bunu çağırır.
 * Var olan bağda ilgi seviyesi verilmişse güncellenir.
 */
export function upsertInterest(q: Q, ctx: Ctx, d: { idea_id: number; person_id: number; interest?: string; note?: string | null; touch_id?: number | null }) {
  const idea = requireRow(ctx, "ideas", d.idea_id);
  const person = requireRow(ctx, "people", d.person_id);
  const cur = row(ctx, "SELECT * FROM idea_people WHERE idea_id = ? AND person_id = ?", d.idea_id, d.person_id);
  if (!cur) {
    const r = q.insert(idea_people).values({
      idea_id: d.idea_id, person_id: d.person_id, interest: (d.interest ?? "anlatildi") as any, note: d.note ?? null, touch_id: d.touch_id ?? null, ...stamp(ctx),
    }).returning().get();
    emit(q, ctx, { type: "idea.told", person_id: person.id, summary: `Fikir anlatıldı: ${truncate(idea.title, 50)}${d.interest && d.interest !== "anlatildi" ? ` (${label(d.interest)})` : ""}`, data: { idea_id: idea.id } });
    return { row: r, effects: [`${person.name} fikre bağlandı`] };
  }
  const set: Record<string, unknown> = {};
  if (d.interest && d.interest !== cur.interest) set.interest = d.interest;
  if (d.note !== undefined && d.note !== cur.note) set.note = d.note;
  if (d.touch_id && !cur.touch_id) set.touch_id = d.touch_id;
  if (Object.keys(set).length) {
    q.update(idea_people).set({ ...set, updated_at: ctx.clock.now() }).where(eq(idea_people.id, cur.id)).run();
    if (set.interest) emit(q, ctx, { type: "idea.interest", person_id: person.id, summary: `Fikre ilgi: ${truncate(idea.title, 50)} → ${label(String(set.interest))}`, data: { idea_id: idea.id } });
  }
  return { row: requireRow(ctx, "idea_people", cur.id), effects: [] as string[] };
}

/** Fikir listesi + ilgi ölçümü: kaç kişiye anlatıldı, kaçı ilgilendi, oran; hedef sektörler; temas ve paylaşım sayısı */
export function ideaStats(ctx: Ctx) {
  const secs = rows<{ idea_id: number; id: number; path: string }>(ctx, `
    SELECT x.idea_id, s.id, CASE WHEN p.name IS NULL THEN s.name ELSE p.name || ' > ' || s.name END AS path
    FROM idea_sectors x JOIN sectors s ON s.id = x.sector_id LEFT JOIN sectors p ON p.id = s.parent_id ORDER BY path`);
  return rows(ctx, `
    SELECT i.*,
      (SELECT COUNT(*) FROM idea_people x WHERE x.idea_id = i.id) AS told,
      (SELECT COUNT(*) FROM idea_people x WHERE x.idea_id = i.id AND x.interest = 'ilgilendi') AS interested,
      (SELECT COUNT(*) FROM idea_people x WHERE x.idea_id = i.id AND x.interest = 'ilgilenmedi') AS not_interested,
      (SELECT COUNT(*) FROM touches t WHERE t.idea_id = i.id) AS touch_count,
      (SELECT COUNT(*) FROM posts p WHERE p.idea_id = i.id) AS post_count,
      (SELECT COUNT(*) FROM people x JOIN posts p ON p.id = x.post_id WHERE p.idea_id = i.id) AS post_people
    FROM ideas i ORDER BY i.updated_at DESC, i.id DESC`)
    .map((i) => {
      const s = secs.filter((x) => x.idea_id === i.id);
      return { ...i, sectors: s.map((x) => ({ id: x.id, path: x.path })), interest_rate: i.told ? i.interested / i.told : null };
    })
    .sort((a, b) => IDEA_STAGES.indexOf(b.stage) - IDEA_STAGES.indexOf(a.stage) || b.updated_at.localeCompare(a.updated_at));
}

/** Bir fikre bağlı kişiler (ilgisiyle) */
export function ideaPeople(ctx: Ctx, ideaId?: number, personId?: number) {
  return rows(ctx, `
    SELECT x.*, p.name AS person_name, c.name AS company_name, i.title AS idea_title, i.stage AS idea_stage
    FROM idea_people x JOIN people p ON p.id = x.person_id JOIN ideas i ON i.id = x.idea_id LEFT JOIN companies c ON c.id = p.company_id
    WHERE (? IS NULL OR x.idea_id = ?) AND (? IS NULL OR x.person_id = ?)
    ORDER BY CASE x.interest WHEN 'ilgilendi' THEN 0 WHEN 'anlatildi' THEN 1 ELSE 2 END, x.updated_at DESC`,
    ideaId ?? null, ideaId ?? null, personId ?? null, personId ?? null);
}

export function ideasService(ctx: Ctx) {
  function create(input: unknown) {
    return ctx.db.transaction((tx) => {
      const { sector_ids, ...d } = parse(ideaCreate, withSectors(tx, ctx, input));
      const r = tx.insert(ideas).values({ ...d, ...stamp(ctx) }).returning().get();
      if (sector_ids?.length) setSectors(tx, ctx, r.id, sector_ids);
      emit(tx, ctx, { type: "idea.created", summary: `Fikir: ${truncate(d.title, 60)}`, data: { idea_id: r.id } });
      return { row: r, effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    return ctx.db.transaction((tx) => {
      const { sector_ids, ...d } = parse(ideaUpdate, withSectors(tx, ctx, input));
      const cur = requireRow(ctx, "ideas", id);
      const effects: string[] = [];
      if (Object.keys(d).length || sector_ids) tx.update(ideas).set({ ...d, updated_at: ctx.clock.now() }).where(eq(ideas.id, id)).run();
      if (sector_ids) setSectors(tx, ctx, id, sector_ids);
      if (d.stage && d.stage !== cur.stage) {
        emit(tx, ctx, { type: "idea.stage", summary: `Fikir ${label(cur.stage)} → ${label(d.stage)}: ${truncate(cur.title, 50)}`, data: { idea_id: id, from: cur.stage, to: d.stage } });
        effects.push(`fikir → ${label(d.stage)}`);
      } else if (Object.keys(d).length || sector_ids) {
        emit(tx, ctx, { type: "idea.updated", summary: `Fikir düzenlendi: ${truncate(d.title ?? cur.title, 60)}`, data: { idea_id: id } });
      }
      return { row: requireRow(ctx, "ideas", id), effects };
    });
  }

  const move = (id: number, stage: string) => {
    if (!(IDEA_STAGES as readonly string[]).includes(stage)) throw new FFError("validation", `fikir aşaması: ${IDEA_STAGES.join(", ")}`);
    return update(id, { stage });
  };

  /** Bağlı kişi ve sektör satırları gider; temas ve paylaşımlar kalır, fikir bağı kopar */
  function remove(id: number) {
    const cur = requireRow(ctx, "ideas", id);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.unlink("touches", "idea_id", id);
      bin.unlink("posts", "idea_id", id);
      bin.take("idea_people", "idea_id = ?", id);
      bin.take("idea_sectors", "idea_id = ?", id);
      bin.take("comments", "target_type = 'idea' AND target_id = ?", id);
      bin.take("ideas", "id = ?", id);
      bin.commit(tx, "idea", id, cur.title);
      emit(tx, ctx, { type: "idea.deleted", summary: `Fikir silindi: ${truncate(cur.title, 60)}` });
      return { effects: [] as string[], trash: { type: "idea", id } };
    });
  }

  // ---- ilgi (fikir ↔ kişi) ----
  function saveInterest(input: unknown) {
    const d = parse(interestSave, input);
    return ctx.db.transaction((tx) => upsertInterest(tx, ctx, d));
  }
  function updateInterest(id: number, input: unknown) {
    const d = parse(interestUpdate, input);
    const cur = requireRow(ctx, "idea_people", id);
    return ctx.db.transaction((tx) => upsertInterest(tx, ctx, { idea_id: cur.idea_id, person_id: cur.person_id, interest: d.interest, note: d.note }));
  }
  function removeInterest(id: number) {
    const cur = requireRow(ctx, "idea_people", id);
    const idea = requireRow(ctx, "ideas", cur.idea_id);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.take("idea_people", "id = ?", id);
      bin.commit(tx, "interest", id, `Fikir ilgisi: ${truncate(idea.title, 50)}`);
      emit(tx, ctx, { type: "idea.untold", person_id: cur.person_id, summary: `Fikir bağı kaldırıldı: ${truncate(idea.title, 50)}` });
      return { effects: [] as string[], trash: { type: "interest", id } };
    });
  }

  return { create, update, move, remove, saveInterest, updateInterest, removeInterest };
}
