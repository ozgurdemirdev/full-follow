import type { Ctx, EntityHandler } from "@fullfollow/core";

const projects = (ctx: Ctx) => ctx.mod("projects")!;

/** The "project" and "payment" record types, for the generic save / find / get / delete / move (the web and MCP use these names) */
export const entities: Record<string, EntityHandler> = {
  project: {
    aliases: ["proje"],
    ref: { table: "projects", col: "name", label: "proje" },
    // the payments come from the relation this module contributes
    related: ["comments", "drafts", "links"],
    save: (ctx, d, id) => (id ? projects(ctx).projects.update(id, d) : projects(ctx).projects.create(d)),
    get: (ctx, id) => projects(ctx).projects.get(id),
    find: (ctx, o) => projects(ctx).projects.list(o),
    delete: (ctx, id) => projects(ctx).projects.remove(id),
    move: (ctx, id, input) => projects(ctx).projects.move(id, input),
  },
  payment: {
    aliases: ["odeme", "ödeme"],
    related: ["comments"],
    save: (ctx, d, id) => (id ? projects(ctx).payments.update(id, d) : projects(ctx).payments.create(d)),
    get: (ctx, id) => projects(ctx).payments.get(id),
    find: (ctx, o) => projects(ctx).payments.list(o),
    delete: (ctx, id) => projects(ctx).payments.remove(id),
  },
};
