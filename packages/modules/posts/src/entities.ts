import type { EntityHandler } from "@fullfollow/core";
import { m } from "./messages";
import { POST_ALIASES } from "./service/constants";

/** The "post" record type, for the generic save / find / get / delete (the web and MCP use this name) */
export const entities: Record<string, EntityHandler> = {
  post: {
    aliases: POST_ALIASES,
    ref: { table: "posts", col: "title", label: m.noun },
    related: ["people", "comments"],
    save: (ctx, d, id) => (id ? ctx.mod("posts")!.update(id, d) : ctx.mod("posts")!.create(d)),
    get: (ctx, id) => ctx.mod("posts")!.get(id),
    find: (ctx, o) => ctx.mod("posts")!.list(o),
    delete: (ctx, id) => ctx.mod("posts")!.remove(id),
  },
};
