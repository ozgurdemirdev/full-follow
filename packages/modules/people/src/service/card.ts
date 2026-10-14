import { FFError, ideaPeople, listThreads, queriesFor, row, type Ctx, type PersonCard } from "@fullfollow/core";
import { peopleList } from "./list";
import { referralValues } from "./referrals";

/**
 * Kişi kartı tek istekte: kişi + sektör + kanal özeti + temaslar + notlar + yorum konuları (mesajlarıyla)
 * + referans eden/tanıttıkları + referans değeri + fırsat/proje + bekleyen taslaklar.
 * Temas parçaları network modülünden gelir (yoksa boş), paylaşım posts modülünden.
 * TODO(modules): opportunities, projects, drafts, notes and ideas through their modules once they are ones (core queries for now)
 */
export function personCard(ctx: Ctx, id: number): PersonCard {
  const q = queriesFor(ctx);
  const network = ctx.mod("network");
  const person = peopleList(ctx, { limit: 100000 }).rows.find((p) => p.id === id);
  if (!person) throw new FFError("not_found", `kişi #${id} bulunamadı`);
  const refs = referralValues(ctx);
  return {
    row: person,
    channels: network?.channels(id, { awaiting: person.awaiting }) ?? [],
    touches: network?.touches.list({ filter: { person_id: id }, limit: 200 }) ?? { rows: [], total: 0 },
    notes: q.notes({ filter: { person_id: id }, limit: 200 }).rows,
    threads: listThreads(ctx, { target_type: "person", target_id: id, resolved: "all", messages: true }),
    referrer: person.referred_by_id ? { id: person.referred_by_id, name: person.referred_by_name } : null,
    referrals: peopleList(ctx, { filter: { referred_by_id: id }, limit: 200 }).rows.map((r) => {
      const v = refs.find((x) => x.person_id === r.id);
      const own = row(ctx, "SELECT COUNT(*) AS opps, COALESCE(SUM(stage = 'kazanildi'), 0) AS won FROM opportunities WHERE person_id = ?", r.id);
      return { id: r.id, name: r.name, company_name: r.company_name, tags: r.tags, sector_path: r.sector_path, opps: own?.opps ?? 0, won: own?.won ?? 0, network: v?.network ?? 0 };
    }),
    referral_value: refs.find((r) => r.person_id === id) ?? null,
    opportunities: q.opportunities({ filter: { person_id: id }, limit: 100 }).rows,
    projects: q.projects({ filter: { person_id: id }, limit: 100 }).rows,
    drafts: q.drafts({ filter: { person_id: id, status: "bekliyor" }, limit: 20 }).rows,
    // Paket 2: kişiyi getiren paylaşım ve anlatılan fikirler
    post: person.post_id ? ctx.mod("posts")?.get(person.post_id) ?? null : null,
    ideas: ideaPeople(ctx, undefined, id),
  };
}
