import { CONTACT_STATUS_RANK, label, row, STICKY_CONTACT_STATUSES, writeEvent as emit, type ContactStatus, type Ctx } from "@fullfollow/core";
import { m } from "../messages";

/**
 * A touch moves a company's contact status forward (never back); a status set by hand ("olumsuz", "tanidik", "arkadas") stays.
 * Returns what changed. The change is stamped (`updated_at`) and written as a `company.status` event in the transaction of the touch that caused it.
 */
export function bumpCompanyStatus(ctx: Ctx, companyId: number, next: ContactStatus): string[] {
  const cur = row<{ contact_status: ContactStatus; name: string }>(ctx, "SELECT contact_status, name FROM companies WHERE id = ?", companyId);
  if (!cur || STICKY_CONTACT_STATUSES.includes(cur.contact_status) || CONTACT_STATUS_RANK[next] <= CONTACT_STATUS_RANK[cur.contact_status]) return [];
  ctx.sqlite.prepare("UPDATE companies SET contact_status = ?, updated_at = ? WHERE id = ?").run(next, ctx.clock.now(), companyId);
  emit(ctx.db, ctx, { type: "company.status", summary: m.events.status(cur.name, label(cur.contact_status), label(next)), data: { company_id: companyId, from: cur.contact_status, to: next } });
  return [`${cur.name}: ${label(next)}`];
}
