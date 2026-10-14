import { rows, type Ctx } from "@fullfollow/core";
import { bumpContactStatus, statusOfTouch } from "./status";

/**
 * Sadece adresle kaydedilmiş temas ve taslaklar (info@, @hesap), aynı adresle açılan kişi ya da firmaya bağlanır.
 * Bağlanan temaslar kaydın durumunu da ilerletir. Çağıran kişi ya da firma servisidir (kayıt yeni açıldığında).
 */
export function adoptLoose(ctx: Ctx, owner: { person_id?: number; company_id?: number }, keys: string[]): string[] {
  const wanted = new Set(keys.map((k) => (k.startsWith("email:") || k.startsWith("instagram:") || k.startsWith("linkedin:") ? k : "")).filter(Boolean));
  if (!wanted.size) return [];
  const col = owner.person_id ? "person_id" : "company_id";
  const id = owner.person_id ?? owner.company_id!;
  const loose = rows<{ id: number; direction: string; kind: string; contact_key: string }>(ctx,
    `SELECT id, direction, kind, contact_key FROM touches WHERE person_id IS NULL AND company_id IS NULL AND contact_key IN (${[...wanted].map(() => "?").join(",")})`, ...wanted);
  for (const t of loose) {
    ctx.sqlite.prepare(`UPDATE touches SET ${col} = ? WHERE id = ?`).run(id, t.id);
    bumpContactStatus(ctx, owner, statusOfTouch(t));
  }
  // the drafts saved with only this address join too (the drafts module owns them)
  ctx.mod("drafts")?.adoptLoose(owner, [...wanted]);
  return loose.length ? [`${loose.length} temas bağlandı`] : [];
}
