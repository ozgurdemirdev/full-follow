import type { Ctx, NetworkApi } from "@fullfollow/core";
import { activity } from "./service/activity";
import { adoptLoose } from "./service/adopt";
import { networkServices } from "./service";
import { channelSummary, companyChannelSummary, networkLists, networkStats, weekStats, weeklyRhythm } from "./service/network";

/** The network module's implementation of its contract (`NetworkApi` in core's contracts) */
export function networkApi(ctx: Ctx): NetworkApi {
  const { touches } = networkServices(ctx);
  return {
    touches,
    stats: (ids) => networkStats(ctx, ids),
    rhythm: (ids) => weeklyRhythm(ctx, ids),
    channels: (personId, net) => channelSummary(ctx, personId, net),
    companyChannels: (companyId) => companyChannelSummary(ctx, companyId),
    lists: (limit) => networkLists(ctx, limit),
    weekStats: (ref) => weekStats(ctx, ref),
    activity: (period) => activity(ctx, period),
    adoptLoose: (owner, keys) => adoptLoose(ctx, owner, keys),
  };
}
