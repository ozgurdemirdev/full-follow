import type { Ctx, EntityHandler } from "@fullfollow/core";
import { m } from "./messages";
import { OFFER_ALIASES, OPPORTUNITY_ALIASES } from "./service/constants";

const pipeline = (ctx: Ctx) => ctx.mod("pipeline")!;

/** The "opportunity" and "offer" record types, for the generic save / find / get / delete / move (the web and MCP use these names) */
export const entities: Record<string, EntityHandler> = {
  opportunity: {
    aliases: OPPORTUNITY_ALIASES,
    ref: { table: "opportunities", col: "title", label: m.noun },
    refKeys: { opp: "opportunity_id" },
    // the team (people), offers and files come from the relations this module contributes
    related: ["comments", "links"],
    save: (ctx, d, id) => (id ? pipeline(ctx).opportunities.update(id, d) : pipeline(ctx).opportunities.create(d)),
    get: (ctx, id) => pipeline(ctx).opportunities.get(id),
    find: (ctx, o) => pipeline(ctx).opportunities.list(o),
    delete: (ctx, id) => pipeline(ctx).opportunities.remove(id),
    move: (ctx, id, input) => pipeline(ctx).opportunities.move(id, input),
  },
  offer: {
    aliases: OFFER_ALIASES,
    save: (ctx, d, id) => (id ? pipeline(ctx).offers.update(id, d) : pipeline(ctx).offers.create(d)),
    get: (ctx, id) => pipeline(ctx).offers.get(id),
    find: (ctx, o) => pipeline(ctx).offers.list(o),
    delete: (ctx, id) => pipeline(ctx).offers.remove(id),
  },
};
