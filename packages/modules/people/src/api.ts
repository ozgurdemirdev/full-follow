import type { Ctx, PeopleApi } from "@fullfollow/core";
import { peopleServices } from "./service";
import { ALL_ROWS } from "./service/constants";
import { personCard } from "./service/card";
import { peopleList } from "./service/list";
import { peopleOverview, peopleSummary, touchQueue } from "./service/overview";
import { bumpPersonStatus } from "./service/status";
import { referralTree } from "./service/tree";

/** The people module's implementation of its contract (`PeopleApi` in core's contracts) */
export function peopleApi(ctx: Ctx): PeopleApi {
  const { people } = peopleServices(ctx);
  return {
    // person rows come from text columns (the schema stays free of module enums); the contract narrows the contact status
    create: people.create as PeopleApi["create"],
    update: people.update as PeopleApi["update"],
    remove: people.remove,
    list: (opts) => peopleList(ctx, opts),
    get: (id) => peopleList(ctx, { limit: ALL_ROWS }).rows.find((p) => p.id === id),
    overview: (opts) => peopleOverview(ctx, opts),
    summary: () => peopleSummary(ctx),
    touchQueue: (opts) => touchQueue(ctx, opts),
    card: (id) => personCard(ctx, id),
    bumpStatus: (id, next) => bumpPersonStatus(ctx, id, next),
    referralTree: () => referralTree(ctx),
  };
}
