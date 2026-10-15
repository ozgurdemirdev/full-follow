import { companyKeys, keyList, type EntityHandler } from "@fullfollow/core";
import { m } from "./messages";

/** The "company" record type, for the generic save / find / get / delete (the web and MCP use this name) */
export const entities: Record<string, EntityHandler> = {
  company: {
    aliases: [m.noun, "companies", m.plural],
    ref: { table: "companies", col: "name", label: m.noun },
    // people, touches, channels and opportunities come from the relations the modules contribute
    related: ["comments"],
    bulk: { label: m.noun, keys: (item) => keyList(companyKeys(item)) },
    save: (ctx, d, id) => (id ? ctx.mod("companies")!.update(id, d) : ctx.mod("companies")!.create(d)),
    get: (ctx, id) => ctx.mod("companies")!.get(id),
    find: (ctx, o) => ctx.mod("companies")!.list(o),
    delete: (ctx, id) => ctx.mod("companies")!.remove(id),
  },
};
