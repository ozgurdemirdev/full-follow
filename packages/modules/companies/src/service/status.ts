import { CONTACT_STATUS_RANK, label, row, STICKY_CONTACT_STATUSES, type ContactStatus, type Ctx } from "@fullfollow/core";

/**
 * A touch moves a company's contact status forward (never back); a status set by hand ("olumsuz", "tanidik", "arkadas") stays.
 * Returns what changed.
 */
export function bumpCompanyStatus(ctx: Ctx, companyId: number, next: ContactStatus): string[] {
  const cur = row<{ contact_status: ContactStatus; name: string }>(ctx, "SELECT contact_status, name FROM companies WHERE id = ?", companyId);
  if (!cur || STICKY_CONTACT_STATUSES.includes(cur.contact_status) || CONTACT_STATUS_RANK[next] <= CONTACT_STATUS_RANK[cur.contact_status]) return [];
  ctx.sqlite.prepare("UPDATE companies SET contact_status = ? WHERE id = ?").run(next, companyId);
  return [`${cur.name}: ${label(next)}`];
}
