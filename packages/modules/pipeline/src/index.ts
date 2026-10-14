import { defineModule, filesOf, OPEN_OPP_STAGES, OPP_STAGES, requireRow, type RecordTrashed, type TouchCreated } from "@fullfollow/core";
import { pipelineApi } from "./api";
import { entities } from "./entities";
import { mcp } from "./mcp";
import { applyStage } from "./service/opportunities";

/**
 * Pipeline: opportunities and their stage moves, the team (extra people) on an opportunity, offers and the lead source funnel.
 * Winning an opportunity emits `opportunity.won` (the projects module opens the project) and tags the person as a customer.
 * Its tables (opportunities, opportunity_people, offers) stay in core's schema; removing this package leaves their rows in place.
 */
export default defineModule({
  key: "pipeline",
  label: "Satış hunisi",
  uses: ["people", "companies", "network", "projects"],
  api: pipelineApi,
  entities,
  hooks: {
    /**
     * A touch about an opportunity moves its stage: found + outgoing is contacted, contacted + incoming is replied, a meeting is a meeting;
     * an offer and later stages are left alone.
     */
    "touch.created": (ctx, { touch, input }: TouchCreated) => {
      if (!touch.opportunity_id) return;
      const o = requireRow(ctx, "opportunities", touch.opportunity_id);
      const next = input.kind === "gorusme" && OPP_STAGES.indexOf(o.stage) < OPP_STAGES.indexOf("gorusme") ? "gorusme"
        : o.stage === "bulundu" && input.direction === "giden" ? "temas" : o.stage === "temas" && input.direction === "gelen" ? "cevap" : null;
      if (!next) return;
      applyStage(ctx.db, ctx, o, next, { auto: true });
      return [`fırsat #${o.id} → ${next}`];
    },
    // the team rows of a person that goes to the trash go with it; an offer's link to a deleted file is emptied
    "record.trashed": (_ctx, { type, id, bin }: RecordTrashed) => {
      if (type === "person") bin.take("opportunity_people", "person_id = ?", id);
      else if (type === "file") bin.unlink("offers", "file_id", id);
    },
  },
  contribute: {
    trashTypes: [{ type: "opportunity", label: "fırsat" }, { type: "offer", label: "teklif" }, { type: "opportunity_person", label: "ekip üyesi" }],
    // the opportunities whose follow-up is due (the people's part of `follow_ups` comes from the people module)
    today: (ctx, { limit }) => ({ follow_ups: { opportunities: ctx.mod("pipeline")!.opportunities.list({ limit, filter: { due: true } }) } }),
    // opportunities count as the "fırsat" column of the sources list
    sourceCounts: (ctx) => ({ opp_count: ctx.mod("pipeline")!.countsBySource() }),
    commentTargets: {
      opportunity: {
        table: "opportunities",
        label: (ctx, id) => ctx.mod("pipeline")!.opportunities.ref(id)?.title ?? `#${id}`,
        link: (_ctx, id) => ({ opportunity_id: id }),
        links: true,
        files: true,
      },
    },
    chatCards: {
      opportunity: (ctx, id) => {
        const r = ctx.mod("pipeline")!.opportunities.get(id);
        if (!r) throw new Error("opportunity not found");
        return { title: r.title, stage: r.stage, value: r.estimated_value, person: r.person_name ?? null };
      },
    },
    meta: { opp_stages: OPP_STAGES, open_opp_stages: OPEN_OPP_STAGES },
    relations: {
      // `get(person | company, id, with: ["opportunities"])`: the opportunities of a person, or of a company's people
      opportunities: { on: ["person", "company"], load: (ctx, by, limit) => ctx.mod("pipeline")!.opportunities.list({ filter: by, limit }).rows.slice(0, limit) },
      // `get(opportunity, id, with: ["people", "offers", "files"])`: the extra people, the offer versions and the uploaded files
      people: { on: ["opportunity"], load: (ctx, by, limit) => ctx.mod("pipeline")!.team.of(by.opportunity_id).slice(0, limit) },
      offers: { on: ["opportunity"], load: (ctx, by, limit) => ctx.mod("pipeline")!.offers.of(by.opportunity_id).slice(0, limit) },
      files: { on: ["opportunity"], load: (ctx, by, limit) => filesOf(ctx, "opportunity", by.opportunity_id).slice(0, limit) },
    },
  },
  mcp,
});
