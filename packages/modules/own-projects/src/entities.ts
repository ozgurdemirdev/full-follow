import { resolveRef, type Ctx, type EntityHandler } from "@fullfollow/core";
import { m } from "./messages";

const projects = (ctx: Ctx) => ctx.mod("own-projects")!;

/** The "own_project" record type, for the generic save / find / get / delete / move (the web and MCP use this name) */
export const entities: Record<string, EntityHandler> = {
  own_project: {
    aliases: ["own", "own_projects", "kendi_proje", "kendi projem", "projelerim", "urunum"],
    ref: { table: "own_projects", col: "name", label: m.project },
    // its ideas come from the relation the ideas module contributes
    related: ["links", "comments"],
    // `{ from_idea: "fikir adı" }` turns a general idea into a project instead of creating one
    save: (ctx, d, id) =>
      d.from_idea !== undefined ? projects(ctx).fromIdea(resolveRef(ctx, "idea", d.from_idea)) : id ? projects(ctx).update(id, d) : projects(ctx).create(d),
    get: (ctx, id) => projects(ctx).get(id),
    find: (ctx, o) => projects(ctx).list(o),
    delete: (ctx, id) => projects(ctx).remove(id),
    move: (ctx, id, input) => projects(ctx).move(id, input.stage),
  },
};
