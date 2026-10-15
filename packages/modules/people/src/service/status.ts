import { CONTACT_STATUS_RANK, label, row, STICKY_CONTACT_STATUSES, writeEvent as emit, type ContactStatus, type Ctx } from "@fullfollow/core";
import { m } from "../messages";

/**
 * A touch moves a person's contact status forward (never back); a status set by hand ("olumsuz", "tanidik", "arkadas") stays.
 * The person's company moves too when the companies module is installed. Returns what changed.
 * The change is stamped (`updated_at`) and written as a `person.status` event in the transaction of the touch that caused it.
 */
export function bumpPersonStatus(ctx: Ctx, personId: number, next: ContactStatus): string[] {
  const out: string[] = [];
  const cur = row<{ contact_status: ContactStatus; name: string; company_id: number | null }>(ctx, "SELECT contact_status, name, company_id FROM people WHERE id = ?", personId);
  if (!cur) return out;
  if (!STICKY_CONTACT_STATUSES.includes(cur.contact_status) && CONTACT_STATUS_RANK[next] > CONTACT_STATUS_RANK[cur.contact_status]) {
    ctx.sqlite.prepare("UPDATE people SET contact_status = ?, updated_at = ? WHERE id = ?").run(next, ctx.clock.now(), personId);
    emit(ctx.db, ctx, { type: "person.status", person_id: personId, summary: m.events.status(cur.name, label(cur.contact_status), label(next)), data: { from: cur.contact_status, to: next } });
    out.push(`${cur.name}: ${label(next)}`);
  }
  if (cur.company_id) out.push(...(ctx.mod("companies")?.bumpStatus(cur.company_id, next) ?? []));
  return out;
}
