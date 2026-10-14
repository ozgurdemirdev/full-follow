import { keptRows, type Ctx, type IdeasApi } from "@fullfollow/core";
import { ideasServices } from "./service";
import { ideaGet, ideaList, ideaRef, interestGet, interestList } from "./service/list";
import { ideaPeople, ideaStats } from "./service/stats";

/** The ideas module's implementation of its contract (`IdeasApi` in core's contracts) */
export function ideasApi(ctx: Ctx): IdeasApi {
  const { ideas } = ideasServices(ctx);
  return {
    // rows come from text and enum columns; the contract narrows what the schema keeps loose
    create: ideas.create as IdeasApi["create"],
    update: ideas.update as IdeasApi["update"],
    move: ideas.move as IdeasApi["move"],
    remove: ideas.remove,
    saveInterest: ideas.saveInterest as IdeasApi["saveInterest"],
    updateInterest: ideas.updateInterest as IdeasApi["updateInterest"],
    removeInterest: ideas.removeInterest,
    list: (opts) => ideaList(ctx, opts),
    get: (id) => ideaGet(ctx, id),
    ref: (id) => ideaRef(ctx, id),
    stats: () => ideaStats(ctx),
    people: (ideaId, personId) => ideaPeople(ctx, ideaId, personId),
    interests: { list: (opts) => interestList(ctx, opts), get: (id) => interestGet(ctx, id) },
    sectorIds: (ideaId) => keptRows<{ sector_id: number }>(ctx, "SELECT sector_id FROM idea_sectors WHERE idea_id = ?", ideaId).map((r) => r.sector_id),
    handOver: (q, ideaId, projectId) => ideas.handOver(q, ideaId, projectId),
  };
}
