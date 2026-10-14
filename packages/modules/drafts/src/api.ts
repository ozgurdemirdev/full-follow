import { contactKey, keptRows, type Ctx, type DraftsApi } from "@fullfollow/core";
import { draftsServices } from "./service";
import { followUpDates, followupsDue, generateFollowups } from "./service/followups";
import { draftGet, draftsList } from "./service/list";
import { outgoingMessageCounts, quotaFor, quotaOverDays } from "./service/quota";

/** The drafts module's implementation of its contract (`DraftsApi` in core's contracts) */
export function draftsApi(ctx: Ctx): DraftsApi {
  const { drafts } = draftsServices(ctx);
  return {
    // rows come from text and enum columns; the contract narrows what the schema keeps loose
    create: drafts.create as DraftsApi["create"],
    update: drafts.update as DraftsApi["update"],
    approve: drafts.approve as DraftsApi["approve"],
    reject: drafts.reject as DraftsApi["reject"],
    markSent: drafts.markSent as DraftsApi["markSent"],
    remove: drafts.remove,
    list: (opts) => draftsList(ctx, opts),
    get: (id) => draftGet(ctx, id),
    followups: { due: () => followupsDue(ctx), generate: () => generateFollowups(ctx) },
    quota: (date = ctx.clock.today()) => quotaFor(ctx, date),
    quotaOverDays: (from, to) => quotaOverDays(ctx, from, to),
    outgoingMessageCounts: (from, to) => outgoingMessageCounts(ctx, from, to),
    followUpDates: (from, to) => followUpDates(ctx, from, to),
    createdSince: (since) => keptRows<{ created_at: string }>(ctx, "SELECT created_at FROM drafts WHERE created_at >= ?", since).map((r) => r.created_at),
    adoptLoose(owner, keys) {
      const wanted = new Set(keys);
      const col = owner.person_id ? "person_id" : "company_id";
      const id = owner.person_id ?? owner.company_id!;
      const loose = keptRows<{ id: number; contact: string }>(ctx, "SELECT id, contact FROM drafts WHERE person_id IS NULL AND company_id IS NULL AND contact IS NOT NULL")
        .filter((d) => wanted.has(contactKey(d.contact) ?? ""));
      for (const d of loose) ctx.sqlite.prepare(`UPDATE drafts SET ${col} = ? WHERE id = ?`).run(id, d.id);
    },
  };
}
