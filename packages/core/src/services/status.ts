import { label, type ContactStatus } from "../constants";
import { row, type Ctx } from "../context";

// set by hand; touches never move these
const STICKY: ContactStatus[] = ["olumsuz", "tanidik", "arkadas"];
const RANK: Record<ContactStatus, number> = { yazilmadi: 0, yazildi: 1, cevap_geldi: 2, gorusuldu: 3, olumsuz: -1, es_gecildi: -1, tanidik: -1, arkadas: -1 };

/** Temastan çıkan durum: arama/görüşme > gelen mesaj (cevap geldi) > giden mesaj (yazıldı) */
export function statusOfTouch(t: { direction: string; kind: string }): ContactStatus {
  if (t.kind === "arama" || t.kind === "gorusme") return "gorusuldu";
  return t.direction === "gelen" ? "cevap_geldi" : "yazildi";
}

/**
 * Temas kaydedilince kişinin ve firmasının durumu ileri gider (geri gitmez). "Olumsuz" elle verilir ve temasla değişmez.
 * Kişiye yazınca kişinin firması da güncellenir. Değişenleri döner.
 */
export function bumpStatus(ctx: Ctx, subject: { person_id?: number | null; company_id?: number | null }, next: ContactStatus): string[] {
  const out: string[] = [];
  const bump = (table: "people" | "companies", id: number) => {
    const cur = row<{ contact_status: ContactStatus; name: string }>(ctx, `SELECT contact_status, name FROM ${table} WHERE id = ?`, id);
    if (!cur || STICKY.includes(cur.contact_status) || RANK[next] <= RANK[cur.contact_status]) return;
    ctx.sqlite.prepare(`UPDATE ${table} SET contact_status = ? WHERE id = ?`).run(next, id);
    out.push(`${cur.name}: ${label(next)}`);
  };
  if (subject.person_id) {
    bump("people", subject.person_id);
    const c = row<{ company_id: number | null }>(ctx, "SELECT company_id FROM people WHERE id = ?", subject.person_id)?.company_id;
    if (c) bump("companies", c);
  }
  if (subject.company_id) bump("companies", subject.company_id);
  return out;
}
