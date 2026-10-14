import { defineModule, row, type RecordTrashed } from "@fullfollow/core";
import { peopleApi } from "./api";
import { entities } from "./entities";
import { mcp } from "./mcp";
import { peopleList } from "./service/list";

/**
 * People: people, their tags and sectors, contact status, the referral tree (referred_by) and the person card.
 * A person saved with a company name opens the company through the companies module. Touch numbers come from the network module.
 * Its tables (people, person_tags, person_sectors) stay in core's schema; removing this package leaves their rows in place.
 */
export default defineModule({
  key: "people",
  label: "Kişiler",
  uses: ["companies", "network", "referrals", "drafts", "ideas"],
  api: peopleApi,
  entities,
  hooks: {
    // the links from a company or a post that goes to the trash are emptied (people stay; restoring ties them back)
    "record.trashed": (_ctx, { type, id, bin }: RecordTrashed) => {
      if (type === "company") bin.unlink("people", "company_id", id);
      else if (type === "post") bin.unlink("people", "post_id", id);
    },
  },
  contribute: {
    trashTypes: [{ type: "person", label: "kişi" }],
    commentTargets: {
      person: {
        table: "people",
        label: (ctx, id) => row(ctx, "SELECT name FROM people WHERE id = ?", id)?.name ?? `#${id}`,
        link: (_ctx, id) => ({ person_id: id }),
      },
    },
    chatCards: {
      person: (ctx, id) => {
        const r = peopleList(ctx, { limit: 100000 }).rows.find((p) => p.id === id);
        if (!r) throw new Error("person not found");
        const open = ctx.mod("drafts")?.list({ filter: { person_id: id }, limit: 10 }).rows.find((d) => d.status === "bekliyor" || d.status === "onaylandi");
        return { title: r.name, role: r.role, company: r.company_name, status: r.contact_status, next_follow_up_at: r.next_follow_up_at, draft_id: open?.id ?? null };
      },
    },
    relations: {
      // `get(person, id, with: ["referrals"])`: the people this person introduced
      referrals: {
        on: ["person"],
        load: (ctx, by, limit) => ctx.mod("people")!.list({ filter: { referred_by_id: by.person_id }, limit }).rows.slice(0, limit),
      },
      // `get(company | post, id, with: ["people"])`: the people of a company, or those who came from a post
      people: {
        on: ["company", "post"],
        load: (ctx, by, limit) => ctx.mod("people")!.list({ filter: by, limit }).rows.slice(0, limit),
      },
    },
  },
  mcp,
});

