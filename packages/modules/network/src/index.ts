import { defineModule, type RecordTrashed } from "@fullfollow/core";
import { networkApi } from "./api";
import { entities } from "./entities";
import { mcp } from "./mcp";
import { networkLists, weekToday } from "./service/network";

/**
 * Network: touches (messages, calls, meetings with a person, a company or a bare address), who waits for an answer,
 * who went cold, and the weekly numbers. Writing a touch moves the contact status of the people and companies modules and emits
 * `touch.created` for the rules that react to it.
 * Its table (touches) stays in core's schema; removing this package leaves the rows in place.
 */
export default defineModule({
  key: "network",
  label: "Temaslar",
  uses: ["people", "companies", "drafts", "ideas"],
  api: networkApi,
  entities,
  hooks: {
    // what points at a record that goes to the trash: touches of a person or company go with it, the links from an opportunity, project or idea are emptied
    "record.trashed": (_ctx, { type, id, bin }: RecordTrashed) => {
      if (type === "person") bin.take("touches", "person_id = ?", id);
      else if (type === "company") bin.take("touches", "company_id = ?", id);
      else if (type === "opportunity") bin.unlink("touches", "opportunity_id", id);
      else if (type === "project") bin.unlink("touches", "project_id", id);
      else if (type === "idea") bin.unlink("touches", "idea_id", id);
    },
  },
  contribute: {
    trashTypes: [{ type: "touch", label: "temas" }],
    // who waits for an answer, who went cold, and this week's numbers, on the Today view
    today: (ctx, { limit }) => ({ network: networkLists(ctx, limit), week: weekToday(ctx) }),
    relations: {
      // `get(person | company | opportunity | project | idea, id, with: ["touches"])`; a company's touches include its people's
      touches: {
        on: ["person", "company", "opportunity", "project", "idea"],
        load: (ctx, by, limit) => ctx.mod("network")!.touches.list({ filter: by.company_id ? { company_scope: by.company_id } : by, limit }).rows.slice(0, limit),
      },
      // `get(person | company, id, with: ["channels"])`: touch counts per channel
      channels: {
        on: ["person", "company"],
        load: (ctx, by, _limit, rec) => {
          const net = ctx.mod("network")!;
          return by.company_id ? net.companyChannels(by.company_id) : net.channels(by.person_id, rec.awaiting ? { awaiting: rec.awaiting } : undefined);
        },
      },
    },
  },
  mcp,
});
