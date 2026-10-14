import type { Ctx, PipelineApi } from "@fullfollow/core";
import { sourceFunnel } from "./service/funnel";
import { pipelineServices } from "./service";
import { countOf, offerGet, offerList, openIdsOf, opportunityGet, opportunityList, opportunityRef, titlesOf } from "./service/list";
import { offersOf } from "./service/offers";
import { pipelineMeta } from "./service/stages";
import { bySource, countsBySource, followUpsDue, lostIn, offerCreatedSince, offersMade, openByCompany, openOfferTimes, personStats } from "./service/stats";
import { teamOf } from "./service/team";

/** The pipeline module's implementation of its contract (`PipelineApi` in core's contracts) */
export function pipelineApi(ctx: Ctx): PipelineApi {
  const { opportunities, offers, team } = pipelineServices(ctx);
  return {
    opportunities: {
      // rows come from text and enum columns; the contract narrows what the schema keeps loose
      create: opportunities.create as PipelineApi["opportunities"]["create"],
      update: opportunities.update as PipelineApi["opportunities"]["update"],
      move: opportunities.move as PipelineApi["opportunities"]["move"],
      remove: opportunities.remove,
      list: (opts) => opportunityList(ctx, opts),
      get: (id) => opportunityGet(ctx, id),
      ref: (id) => opportunityRef(ctx, id),
      titles: (ids) => titlesOf(ctx, ids),
      openIdsOf: (personId) => openIdsOf(ctx, personId),
      countOf: (personId) => countOf(ctx, personId),
    },
    offers: {
      create: offers.create as PipelineApi["offers"]["create"],
      update: offers.update as PipelineApi["offers"]["update"],
      remove: offers.remove,
      list: (opts) => offerList(ctx, opts),
      get: (id) => offerGet(ctx, id),
      of: (opportunityId) => offersOf(ctx, opportunityId) as ReturnType<PipelineApi["offers"]["of"]>,
    },
    team: {
      add: team.add,
      update: team.update,
      remove: team.remove,
      of: (opportunityId) => teamOf(ctx, opportunityId),
    },
    funnel: (period) => sourceFunnel(ctx, period),
    bySource: () => bySource(ctx),
    countsBySource: () => countsBySource(ctx),
    openByCompany: () => openByCompany(ctx),
    meta: () => pipelineMeta(ctx),
    personStats: () => personStats(ctx),
    followUpsDue: (from, to) => followUpsDue(ctx, from, to),
    offersMade: (from, to) => offersMade(ctx, from, to),
    lostIn: (ym) => lostIn(ctx, ym),
    openOfferTimes: () => openOfferTimes(ctx),
    offerCreatedSince: (since) => offerCreatedSince(ctx, since),
  };
}
