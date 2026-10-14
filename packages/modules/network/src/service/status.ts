import type { ContactStatus, Ctx } from "@fullfollow/core";

/** Temastan çıkan durum: arama/görüşme > gelen mesaj (cevap geldi) > giden mesaj (yazıldı) */
export function statusOfTouch(t: { direction: string; kind: string }): ContactStatus {
  if (t.kind === "arama" || t.kind === "gorusme") return "gorusuldu";
  return t.direction === "gelen" ? "cevap_geldi" : "yazildi";
}

/**
 * A touch moves the contact status of its person (and, through the people module, the person's company) or of its company forward.
 * The statuses live in the people and companies modules; without them nothing moves. Returns what changed.
 */
export function bumpContactStatus(ctx: Ctx, subject: { person_id?: number | null; company_id?: number | null }, next: ContactStatus): string[] {
  const out: string[] = [];
  if (subject.person_id) out.push(...(ctx.mod("people")?.bumpStatus(subject.person_id, next) ?? []));
  if (subject.company_id) out.push(...(ctx.mod("companies")?.bumpStatus(subject.company_id, next) ?? []));
  return out;
}
