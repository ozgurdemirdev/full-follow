import type { Ctx, EntityHandler } from "@fullfollow/core";

const templates = (ctx: Ctx) => ctx.mod("templates")!;

/** The "template" record type, for the generic save / find / get / delete (the web and MCP use this name) */
export const entities: Record<string, EntityHandler> = {
  template: {
    aliases: ["sablon", "şablon", "templates"],
    ref: { table: "templates", col: "name", label: "şablon" },
    // the drafts made from a template come from the relation the drafts module contributes
    save: (ctx, d, id) => (id ? templates(ctx).update(id, d) : templates(ctx).create(d)),
    get: (ctx, id) => templates(ctx).get(id),
    find: (ctx, o) => templates(ctx).list(o),
    delete: (ctx, id) => templates(ctx).remove(id),
  },
};
