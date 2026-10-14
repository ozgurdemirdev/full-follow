import type { Ctx, EntityHandler } from "@fullfollow/core";

const ideas = (ctx: Ctx) => ctx.mod("ideas")!;

/** The "idea" and "interest" record types, for the generic save / find / get / delete / move (the web and MCP use these names) */
export const entities: Record<string, EntityHandler> = {
  idea: {
    aliases: ["fikir", "ideas"],
    ref: { table: "ideas", col: "title", label: "fikir" },
    // `parent: "üst fikir"` names the parent idea
    refKeys: { parent: "parent_id" },
    // the people told, touches and posts come from the relations the modules contribute
    related: ["comments"],
    save: (ctx, d, id) => (id ? ideas(ctx).update(id, d) : ideas(ctx).create(d)),
    get: (ctx, id) => ideas(ctx).get(id),
    find: (ctx, o) => ideas(ctx).list(o),
    delete: (ctx, id) => ideas(ctx).remove(id),
    move: (ctx, id, input) => ideas(ctx).move(id, input.stage),
  },
  interest: {
    aliases: ["ilgi"],
    save: (ctx, d, id) => (id ? ideas(ctx).updateInterest(id, d) : ideas(ctx).saveInterest(d)),
    get: (ctx, id) => ideas(ctx).interests.get(id),
    find: (ctx, o) => ideas(ctx).interests.list(o),
    delete: (ctx, id) => ideas(ctx).removeInterest(id),
  },
};
