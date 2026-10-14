import type { Ctx, EntityHandler } from "@fullfollow/core";

const drafts = (ctx: Ctx) => ctx.mod("drafts")!;

/** The "draft" record type, for the generic save / find / get / delete (the web and MCP use this name) */
export const entities: Record<string, EntityHandler> = {
  draft: {
    aliases: ["taslak"],
    related: ["comments"],
    save: (ctx, d, id) => (id ? drafts(ctx).update(id, d) : drafts(ctx).create(d)),
    get: (ctx, id) => drafts(ctx).get(id),
    find: (ctx, o) => drafts(ctx).list(o),
    delete: (ctx, id) => drafts(ctx).remove(id),
  },
};
