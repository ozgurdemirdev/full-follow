import { eq } from "drizzle-orm";
import { emit, FFError, norm, parse, row, rows, stamp, type Ctx } from "../context";
import type { Q } from "../db/client";
import { sectors } from "../db/schema";
import { sectorCreate, sectorUpdate } from "../schemas";
import { duplicate } from "./dupes";
import { requireRow } from "./shared";
import { restoreCategory, softDelete } from "./trash";

export interface SectorRow {
  id: number;
  name: string;
  parent_id: number | null;
  parent_name: string | null;
  /** "Sağlık > Diş hekimi" */
  path: string;
}

/** Sektör yolu ("Sağlık > Diş hekimi") */
export function sectorPath(ctx: Ctx, id: number | null | undefined): SectorRow | null {
  if (!id) return null;
  const s = row(ctx, "SELECT s.id, s.name, s.parent_id, p.name AS parent_name FROM sectors s LEFT JOIN sectors p ON p.id = s.parent_id WHERE s.id = ?", id);
  return s ? { ...s, path: s.parent_name ? `${s.parent_name} > ${s.name}` : s.name } : null;
}

/** Bir sektör ve alt sektörlerinin id'leri (ana sektörle filtre alt sektörleri de kapsar) */
export function sectorIds(ctx: Ctx, id: number): number[] {
  return [id, ...rows<{ id: number }>(ctx, "SELECT id FROM sectors WHERE parent_id = ?", id).map((r) => r.id)];
}

/** Aynı üst sektörde aynı adlı sektör (silinmiş olan da sayılır; etkin olan önce) */
const findChild = (ctx: Ctx, name: string, parentId: number | null) =>
  rows<{ id: number; name: string; deleted_at: string | null }>(ctx,
    `SELECT id, name, deleted_at FROM sectors WHERE ${parentId ? "parent_id = ?" : "parent_id IS NULL"} ORDER BY deleted_at IS NOT NULL`, ...(parentId ? [parentId] : []))
    .find((s) => norm(s.name) === norm(name));

/** İki seviye kuralı: üst sektör ana sektör olmalı */
function checkParent(ctx: Ctx, parentId: number | null | undefined, selfId?: number) {
  if (!parentId) return;
  if (parentId === selfId) throw new FFError("validation", "sektör kendi altına bağlanamaz");
  const p = requireRow(ctx, "sectors", parentId, "üst sektör");
  if (p.parent_id) throw new FFError("validation", `sektör en fazla iki seviye: "${p.name}" zaten bir alt sektör`);
}

function insert(q: Q, ctx: Ctx, name: string, parentId: number | null) {
  const dup = findChild(ctx, name, parentId);
  if (dup) throw duplicate({ type: "sector", id: dup.id, label: dup.name, field: "ad", in_trash: !!dup.deleted_at });
  const r = q.insert(sectors).values({ name, parent_id: parentId, ...stamp(ctx) }).returning().get();
  emit(q, ctx, { type: "sector.created", summary: `Sektör eklendi: ${sectorPath(ctx, r.id)!.path}` });
  return r;
}

/**
 * "Sağlık > Diş hekimi" ya da "Diş hekimi" → sektör id. Yol verilirse eksik sektörler açılır.
 * Tek ad verilirse var olan (ana ya da alt) sektör eşleşir; yoksa ana sektör olarak açılır.
 * Silinmiş sektör de eşleşir (yeniden açılmaz); yeni kayda seçilip seçilemeyeceğine çağıran karar verir.
 */
export function ensureSector(q: Q, ctx: Ctx, input: string | number | null): number | null {
  if (input === null || input === "") return null;
  const s = String(input).trim();
  const m = /^#?(\d+)$/.exec(s);
  if (m) return requireRow(ctx, "sectors", Number(m[1]), "sektör").id;
  const parts = s.split(/\s*[>/]\s*/).map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length > 2) throw new FFError("validation", "sektör en fazla iki seviye: \"Ana > Alt\"");
  if (parts.length === 1) {
    const all = rows<{ id: number; name: string; deleted_at: string | null }>(ctx, "SELECT id, name, deleted_at FROM sectors").filter((x) => norm(x.name) === norm(parts[0]));
    const live = all.filter((x) => !x.deleted_at);
    const hits = live.length ? live : all;
    if (hits.length === 1) return hits[0].id;
    if (hits.length > 1) {
      const cand = hits.map((h) => sectorPath(ctx, h.id)!.path);
      throw new FFError("ambiguous", `"${s}" birden fazla sektörle eşleşiyor: ${cand.join(", ")}. "Ana > Alt" biçiminde yaz`);
    }
    return insert(q, ctx, parts[0], null).id;
  }
  const parent = findChild(ctx, parts[0], null)?.id ?? insert(q, ctx, parts[0], null).id;
  return findChild(ctx, parts[1], parent)?.id ?? insert(q, ctx, parts[1], parent).id;
}

export function sectorsService(ctx: Ctx) {
  /** {name, parent_id} ya da {name, parent: "Sağlık"} ya da {name: "Sağlık > Diş hekimi"} */
  function create(input: unknown) {
    return ctx.db.transaction((tx) => {
      const raw = { ...(input as Record<string, any>) };
      if (typeof raw.name === "string" && /[>/]/.test(raw.name) && raw.parent === undefined && raw.parent_id === undefined) {
        const id = ensureSector(tx, ctx, raw.name)!;
        return { row: requireRow(ctx, "sectors", id), effects: [] as string[] };
      }
      if (raw.parent !== undefined && raw.parent_id === undefined) raw.parent_id = ensureSector(tx, ctx, raw.parent);
      const d = parse(sectorCreate, raw);
      checkParent(ctx, d.parent_id);
      return { row: insert(tx, ctx, d.name, d.parent_id ?? null), effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    const d = parse(sectorUpdate, input);
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "sectors", id, "sektör");
      if (d.parent_id !== undefined && d.parent_id !== cur.parent_id) {
        checkParent(ctx, d.parent_id, id);
        if (d.parent_id && row(ctx, "SELECT 1 x FROM sectors WHERE parent_id = ?", id)) {
          throw new FFError("validation", `"${cur.name}" altında sektörler var; başka sektörün altına taşınamaz (en fazla iki seviye)`);
        }
      }
      const name = d.name ?? cur.name;
      const parent = d.parent_id !== undefined ? d.parent_id : cur.parent_id;
      const dup = findChild(ctx, name, parent);
      if (dup && dup.id !== id) throw duplicate({ type: "sector", id: dup.id, label: dup.name, field: "ad", in_trash: !!dup.deleted_at });
      if (Object.keys(d).length) {
        tx.update(sectors).set({ ...d, updated_at: ctx.clock.now() }).where(eq(sectors.id, id)).run();
        emit(tx, ctx, { type: "sector.updated", summary: `Sektör güncellendi: ${sectorPath(ctx, id)!.path}` });
      }
      return { row: requireRow(ctx, "sectors", id), effects: [] as string[] };
    });
  }

  /** Yerinde gizlenir (alt sektörleriyle): kayıtlarda kalır, yeni kayda seçilemez; Çöp kutusundan geri gelir */
  const remove = (id: number) => softDelete(ctx, "sector", id, "parent_id = ?");
  const restore = (id: number) => restoreCategory(ctx, "sector", id, "parent_id = ?");

  return { create, update, remove, restore };
}
