import { emit, FFError, row, rows, stamp, type Ctx } from "../context";
import type { Q } from "../db/client";
import { trash } from "../db/schema";
import { CORE_TRASH_TYPES } from "../constants";
import { TABLE_LABEL } from "./shared";

interface Part {
  table: string;
  rows: Record<string, unknown>[];
}
/** Silme sırasında boşaltılan bağlar (ör. tanıttığı kişilerin referred_by_id'si): geri yüklenince yeniden kurulur */
interface Unlink {
  table: string;
  col: string;
  value: number;
  ids: number[];
}

/**
 * Silme kutusu: kayıt ve alt kayıtları önce buraya alınır, sonra silinir; hepsi tek çöp kutusu satırına yazılır.
 * take() çağrıları alt kayıttan üst kayda doğru yapılır (foreign key sırası); geri yükleme tersten ekler.
 * Çağıran, silmeyle aynı transaction içinde kullanır.
 */
export class Bin {
  private parts: Part[] = [];
  private links: Unlink[] = [];

  constructor(private ctx: Ctx) {}

  /** WHERE koşuluna uyan satırları kutuya alır ve siler */
  take(table: string, where: string, ...params: unknown[]): Record<string, unknown>[] {
    const list = rows(this.ctx, `SELECT * FROM ${table} WHERE ${where}`, ...params);
    if (list.length) {
      this.parts.push({ table, rows: list });
      this.ctx.sqlite.prepare(`DELETE FROM ${table} WHERE ${where}`).run(...params);
    }
    return list;
  }

  /** table.col = value olan satırlarda bağı boşaltır */
  unlink(table: string, col: string, value: number): void {
    const ids = rows<{ id: number }>(this.ctx, `SELECT id FROM ${table} WHERE ${col} = ?`, value).map((r) => r.id);
    if (!ids.length) return;
    this.links.push({ table, col, value, ids });
    this.ctx.sqlite.prepare(`UPDATE ${table} SET ${col} = NULL WHERE ${col} = ?`).run(value);
  }

  /** Çöp kutusu satırını yazar; keys: mükerrer kontrolünde kullanılacak anahtarlar ("email:a@b.com") */
  commit(q: Q, type: string, recordId: number, label: string, keys: string[] = []) {
    return q.insert(trash).values({
      type, record_id: recordId, label, ...stamp(this.ctx),
      payload: JSON.stringify({ parts: this.parts, links: this.links }),
      keys: keys.length ? JSON.stringify(keys) : null,
    }).returning().get();
  }
}

/** Çöp kutusundaki anahtar eşleşmesi (mükerrer kontrolü) */
export function trashKeyHit(ctx: Ctx, keys: string[]): { trash_id: number; type: string; record_id: number; label: string; key: string } | undefined {
  if (!keys.length) return undefined;
  return row(ctx, `SELECT t.id AS trash_id, t.type, t.record_id, t.label, j.value AS key FROM trash t, json_each(t.keys) j
    WHERE t.keys IS NOT NULL AND j.value IN (${keys.map(() => "?").join(",")}) ORDER BY t.id DESC LIMIT 1`, ...keys);
}

const DELETED_TABLES = { tag: "tags", sector: "sectors", source: "sources" } as const;

export interface TrashItem {
  /** çöp kutusu satırı (kayıt) ya da gizlenen kategori */
  type: string;
  id: number;
  label: string;
  what: string;
  deleted_at: string;
  deleted_by: string | null;
  trash_id: number | null;
}

/** Çöp kutusu: silinen kayıtlar + silinen etiket, sektör ve kaynaklar (yeniden eskiye) */
export function trashList(ctx: Ctx): TrashItem[] {
  const recs = rows(ctx, "SELECT id, type, record_id, label, created_at, created_by FROM trash ORDER BY id DESC").map((t) => ({
    type: t.type, id: t.record_id, label: t.label, what: typeLabel(ctx, t.type), deleted_at: t.created_at, deleted_by: t.created_by, trash_id: t.id,
  }));
  const cats = Object.entries(DELETED_TABLES).flatMap(([type, table]) =>
    rows(ctx, `SELECT id, name, deleted_at FROM ${table} WHERE deleted_at IS NOT NULL`).map((c) => ({
      type, id: c.id, label: c.name, what: TABLE_LABEL[table] ?? type, deleted_at: c.deleted_at, deleted_by: null, trash_id: null,
    })));
  const chats = rows(ctx, "SELECT id, title, deleted_at FROM chat_sessions WHERE deleted_at IS NOT NULL").map((c) => ({
    type: "chat_session", id: c.id, label: c.title, what: CORE_TYPE_LABEL.chat_session, deleted_at: c.deleted_at, deleted_by: null, trash_id: null,
  }));
  return [...recs, ...cats, ...chats].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
}

/** Turkish names of the record types core owns; module types bring theirs through the registry (`typeLabel`) */
const CORE_TYPE_LABEL: Record<string, string> = {
  person: "kişi", company: "firma", opportunity: "fırsat", project: "proje", task: "görev", touch: "temas", note: "not",
  post: "paylaşım", template: "şablon", idea: "fikir", own_project: "kendi projesi", draft: "taslak", payment: "ödeme", comment: "yorum", interest: "fikir ilgisi", link: "link", goal: "hedef",
  opportunity_person: "ekip üyesi", offer: "teklif", file: "dosya",
  tag: "etiket", sector: "sektör", source: "kaynak", chat_session: "sohbet",
};

/** Turkish name of a record type: core types, then the installed modules' types; the type itself when nobody names it */
export const typeLabel = (ctx: Ctx, type: string): string => CORE_TYPE_LABEL[type] ?? ctx.types.label(type) ?? type;

/** Record types whose deleted records go to the trash: the core ones and those the installed modules register */
export const isTrashType = (ctx: Ctx, type: string): boolean =>
  (CORE_TRASH_TYPES as readonly string[]).includes(type) || ctx.types.trashTypes().some((t) => t.type === type);

/**
 * Geri yükleme: kayıt silindiği haliyle aynı id'lerle geri gelir (alt kayıtlar ve boşaltılan bağlar dahil).
 * check: geri gelecek anahtarlar başka bir kayıtta kullanılıyorsa hata (mükerrer kontrolü çağıranda).
 * Bağlı olduğu kayıt da silinmişse önce onun geri yüklenmesi gerekir.
 */
export function restoreFromTrash(ctx: Ctx, type: string, recordId: number, check?: (keys: string[]) => void) {
  const t = row(ctx, "SELECT * FROM trash WHERE type = ? AND record_id = ? ORDER BY id DESC LIMIT 1", type, recordId);
  if (!t) throw new FFError("not_found", `çöp kutusunda ${typeLabel(ctx, type)} #${recordId} yok`);
  const keys: string[] = t.keys ? JSON.parse(t.keys) : [];
  check?.(keys);
  const { parts, links } = JSON.parse(t.payload) as { parts: Part[]; links: Unlink[] };
  try {
    ctx.db.transaction((tx) => {
      for (const p of [...parts].reverse()) {
        for (const r of p.rows) {
          const cols = Object.keys(r);
          // id'siz bağ tabloları (etiket, sektör) zaten varsa atlanır
          const verb = "id" in r ? "INSERT" : "INSERT OR IGNORE";
          ctx.sqlite.prepare(`${verb} INTO ${p.table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...cols.map((c) => r[c] as any));
        }
      }
      for (const l of links) {
        ctx.sqlite.prepare(`UPDATE ${l.table} SET ${l.col} = ? WHERE ${l.col} IS NULL AND id IN (${l.ids.map(() => "?").join(",")})`).run(l.value, ...l.ids);
      }
      ctx.sqlite.prepare("DELETE FROM trash WHERE id = ?").run(t.id);
      emit(tx, ctx, {
        type: `${type}.restored`, summary: `Geri yüklendi (${typeLabel(ctx, type)}): ${t.label}`,
        ...personLinkOf(type, parts),
      });
    });
  } catch (e) {
    if (e instanceof FFError) throw e;
    if (e instanceof Error && /FOREIGN KEY/i.test(e.message)) {
      throw new FFError("rule", `${t.label} geri yüklenemedi: bağlı olduğu kayıt da silinmiş, önce onu geri yükle`);
    }
    throw e;
  }
  return { label: t.label as string, effects: [`${t.label} geri yüklendi`] };
}

/** Geri yüklenen kaydın olayı kişi/fırsat/proje zaman çizelgesinde de görünsün */
function personLinkOf(type: string, parts: Part[]) {
  const main = parts[parts.length - 1]?.rows[0] ?? {};
  const n = (k: string) => (typeof main[k] === "number" ? (main[k] as number) : null);
  if (type === "person") return { person_id: n("id") };
  if (type === "opportunity") return { person_id: n("person_id"), opportunity_id: n("id") };
  if (type === "project") return { person_id: n("person_id"), opportunity_id: n("opportunity_id"), project_id: n("id") };
  return { person_id: n("person_id"), opportunity_id: n("opportunity_id"), project_id: n("project_id") };
}

/** Kategori (etiket, sektör, kaynak) yerinde gizlenir: kayıtlarda kalır, yeni kayda seçilemez */
export function softDelete(ctx: Ctx, type: keyof typeof DELETED_TABLES, id: number, extraWhere?: string) {
  const table = DELETED_TABLES[type];
  const cur = row(ctx, `SELECT * FROM ${table} WHERE id = ?`, id);
  if (!cur) throw new FFError("not_found", `${CORE_TYPE_LABEL[type]} #${id} bulunamadı`);
  if (cur.deleted_at) return { effects: [] as string[], label: cur.name as string };
  const now = ctx.clock.now();
  ctx.db.transaction((tx) => {
    ctx.sqlite.prepare(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?${extraWhere ? ` OR (${extraWhere})` : ""}`).run(now, now, id, ...(extraWhere ? [id] : []));
    emit(tx, ctx, { type: `${type}.deleted`, summary: `${cap(CORE_TYPE_LABEL[type])} silindi: ${cur.name}` });
  });
  return { effects: [] as string[], label: cur.name as string };
}

export function restoreCategory(ctx: Ctx, type: keyof typeof DELETED_TABLES, id: number, extraWhere?: string) {
  const table = DELETED_TABLES[type];
  const cur = row(ctx, `SELECT * FROM ${table} WHERE id = ?`, id);
  if (!cur) throw new FFError("not_found", `${CORE_TYPE_LABEL[type]} #${id} bulunamadı`);
  if (!cur.deleted_at) return { effects: [] as string[] };
  const now = ctx.clock.now();
  ctx.db.transaction((tx) => {
    // birlikte silinenler (ana sektörle alt sektörleri) birlikte döner
    ctx.sqlite.prepare(`UPDATE ${table} SET deleted_at = NULL, updated_at = ? WHERE id = ?${extraWhere ? ` OR (${extraWhere} AND deleted_at = ?)` : ""}`)
      .run(now, id, ...(extraWhere ? [id, cur.deleted_at] : []));
    emit(tx, ctx, { type: `${type}.restored`, summary: `Geri yüklendi (${CORE_TYPE_LABEL[type]}): ${cur.name}` });
  });
  return { effects: [`${cur.name} geri yüklendi`] };
}

export const isCategory = (t: string): t is keyof typeof DELETED_TABLES => t in DELETED_TABLES;
const cap = (s: string) => s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);
