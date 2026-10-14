import { companyKeys, keyList, type EntityHandler } from "@fullfollow/core";

/** The "company" record type, for the generic save / find / get / delete (the web and MCP use this name) */
export const entities: Record<string, EntityHandler> = {
  company: {
    aliases: ["firma", "companies", "firmalar"],
    ref: { table: "companies", col: "name", label: "firma" },
    // people, touches, channels and opportunities come from the relations the modules contribute
    related: ["drafts", "comments"],
    bulk: { label: "firma", keys: (item) => keyList(companyKeys(item)) },
    save: (ctx, d, id) => (id ? ctx.mod("companies")!.update(id, d) : ctx.mod("companies")!.create(d)),
    get: (ctx, id) => ctx.mod("companies")!.get(id),
    find: (ctx, o) => ctx.mod("companies")!.list(o),
    delete: (ctx, id) => ctx.mod("companies")!.remove(id),
  },
};
