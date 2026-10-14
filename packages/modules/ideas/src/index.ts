import { defineModule, IDEA_PRIORITIES, IDEA_STAGES, INTEREST_LEVELS, row, type RecordTrashed, type TouchCreated, type TouchUpdated } from "@fullfollow/core";
import { ideasApi } from "./api";
import { entities } from "./entities";
import { mcp } from "./mcp";
import { upsertInterest } from "./service/ideas";

/**
 * Ideas: money ideas, the people they were told to and how interested they were. A touch about an idea links its person to it,
 * a person or touch that goes to the trash takes or frees the interest rows, and an own project can take an idea over.
 * Its tables (ideas, idea_sectors, idea_people) stay in core's schema; removing this package leaves their rows in place.
 */
export default defineModule({
  key: "ideas",
  label: "Fikirler",
  uses: ["people", "network", "own-projects", "posts"],
  api: ideasApi,
  entities,
  hooks: {
    /** A touch about an idea links its person to it ("told"; an existing link keeps its interest) */
    "touch.created": (ctx, { touch, subject, input }: TouchCreated) =>
      input.idea_id && subject.person_id ? upsertInterest(ctx.db, ctx, { idea_id: input.idea_id, person_id: subject.person_id, touch_id: touch.id }).effects : undefined,
    /** A touch edited to be about an idea links its person to the idea */
    "touch.updated": (ctx, { touch, changes }: TouchUpdated) =>
      changes.idea_id ? upsertInterest(ctx.db, ctx, { idea_id: changes.idea_id, person_id: touch.person_id!, touch_id: touch.id }).effects : undefined,
    // a person's interest rows go with them (before the network module takes the touches they point at); a deleted touch frees its link; an own project that goes lets its ideas fall back to the general list
    "record.trashed": (_ctx, { type, id, bin }: RecordTrashed) => {
      if (type === "person") bin.take("idea_people", "person_id = ?", id);
      else if (type === "touch") bin.unlink("idea_people", "touch_id", id);
      else if (type === "own_project") bin.unlink("ideas", "own_project_id", id);
    },
  },
  contribute: {
    trashTypes: [{ type: "idea", label: "fikir" }, { type: "interest", label: "fikir ilgisi" }],
    commentTargets: {
      idea: { table: "ideas", label: (ctx, id) => row(ctx, "SELECT title FROM ideas WHERE id = ?", id)?.title ?? `#${id}` },
    },
    chatCards: {
      idea: (ctx, id) => {
        const r = ctx.mod("ideas")!.get(id);
        if (!r) throw new Error("idea not found");
        return { title: r.title, stage: r.stage };
      },
    },
    relations: {
      // `get(idea, id, with: ["people"])`: the people told about an idea, with their interest
      people: { on: ["idea"], load: (ctx, by, limit) => ctx.mod("ideas")!.people(by.idea_id).slice(0, limit) },
      // `get(own_project, id, with: ["ideas"])`: the ideas of a project, open ones first by priority and position, done ones after
      ideas: {
        on: ["own_project"],
        load: (ctx, by, limit) => {
          const prio = (x: { priority: string }) => IDEA_PRIORITIES.indexOf(x.priority as never);
          return ctx.mod("ideas")!.stats().filter((i) => i.own_project_id === by.own_project_id)
            .sort((a, b) => Number(!!a.done_at) - Number(!!b.done_at) || (a.done_at ? b.done_at!.localeCompare(a.done_at!) : prio(a) - prio(b) || a.position - b.position || a.id - b.id))
            .slice(0, limit);
        },
      },
    },
    meta: { idea_stages: IDEA_STAGES, interest_levels: INTEREST_LEVELS },
  },
  mcp,
});
