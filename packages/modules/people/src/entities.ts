import { keyList, personKeys, type EntityHandler } from "@fullfollow/core";
import { withCompany } from "./service/withCompany";

/** The "person" record type, for the generic save / find / get / delete (the web and MCP use this name) */
export const entities: Record<string, EntityHandler> = {
  person: {
    aliases: ["kisi", "kişi", "people"],
    ref: { table: "people", col: "name", label: "kişi" },
    // `referred_by: "Ada"` names the introducer
    refKeys: { referred_by: "referred_by_id" },
    // touches, referrals, channels, opportunities and projects come from the relations the modules contribute
    related: ["comments", "drafts", "notes"],
    bulk: { label: "kişi", keys: (item) => keyList(personKeys(item)) },
    prepare: withCompany,
    save: (ctx, d, id) => (id ? ctx.mod("people")!.update(id, d) : ctx.mod("people")!.create(d)),
    get: (ctx, id) => {
      const people = ctx.mod("people")!;
      const row = people.get(id);
      // the referral value comes from the referrals module (null without it)
      return row && { ...row, referral_value: ctx.mod("referrals")?.of(id) ?? null };
    },
    find: (ctx, o) => ctx.mod("people")!.list(o),
    delete: (ctx, id) => ctx.mod("people")!.remove(id),
  },
};
