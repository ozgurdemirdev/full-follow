import { defineModule, filesOf, MILESTONES, PROJECT_STAGES, type OpportunityWon } from "@fullfollow/core";
import { projectsApi } from "./api";
import { entities } from "./entities";
import { mcp } from "./mcp";
import { m } from "./messages";
import { PAYMENTS_DUE_DAYS } from "./service/constants";
import { openProjectForWonOpportunity } from "./service/projects";

/**
 * Projects: projects and their payments (the plan from the template, partial payments, the deposit rule) and the money reports.
 * A won opportunity opens its project through the `opportunity.won` event of the pipeline module. Money due shows on the Today view and the calendar.
 * Its tables (projects, payments) stay in core's schema; removing this package leaves their rows in place.
 */
export default defineModule({
  key: "projects",
  label: m.label,
  smoke: ["/api/projects", "/api/payments"],
  uses: ["pipeline", "calendar"],
  api: projectsApi,
  entities,
  hooks: {
    // the project of a won opportunity, with its payment plan; the effects join the move's effects
    "opportunity.won": (ctx, won: OpportunityWon) => openProjectForWonOpportunity(ctx.db, ctx, won),
  },
  contribute: {
    // the events the timeline module shows in its global feed: a payment received (its amount is in TL in the event data) and a project opened or moved
    timelineKinds: {
      "payment.paid": { kind: "odeme", amount: "amount" },
      "project.created": { kind: "asama" },
      "project.stage": { kind: "asama" },
    },
    trashTypes: [{ type: "project", label: m.noun }, { type: "payment", label: m.paymentNoun }],
    commentTargets: {
      project: {
        table: "projects",
        label: (ctx, id) => ctx.mod("projects")!.projects.ref(id)?.name ?? `#${id}`,
        link: (_ctx, id) => ({ project_id: id }),
        links: true,
        files: true,
        // a project shows the links of the opportunity it came from
        linksFrom: (ctx, id) => {
          const opportunityId = ctx.mod("projects")!.projects.ref(id)?.opportunity_id;
          return opportunityId ? { type: "opportunity", id: opportunityId, from: m.opportunityLabel } : undefined;
        },
      },
      payment: {
        table: "payments",
        label: (ctx, id) => {
          const p = ctx.mod("projects")!.payments.ref(id);
          return m.paymentLabel(id, p?.milestone);
        },
        link: (ctx, id) => ({ project_id: ctx.mod("projects")!.payments.ref(id)?.project_id }),
      },
    },
    chatCards: {
      payment: (ctx, id) => {
        const projects = ctx.mod("projects")!;
        const r = projects.payments.get(id);
        if (!r) throw new Error(m.notFound);
        const project = projects.projects.get(r.project_id)!;
        return { title: `${project.name}`, project_id: r.project_id, milestone: r.milestone, expected: r.expected_amount, paid: r.paid_amount, due_date: r.due_date };
      },
    },
    meta: { project_stages: PROJECT_STAGES, milestones: MILESTONES },
    // an event that names only the project also carries the opportunity and person it came from
    recordLinks: { project_id: (ctx, id) => ctx.mod("projects")!.projects.ref(id) },
    // payments due in the next week, on the Today view
    today: (ctx, { limit }) => ({ payments: ctx.mod("projects")!.payments.list({ limit, filter: { due_within_days: PAYMENTS_DUE_DAYS } }) }),
    relations: {
      // `get(person, id, with: ["projects"])`
      projects: { on: ["person"], load: (ctx, by, limit) => ctx.mod("projects")!.projects.list({ filter: by, limit }).rows.slice(0, limit) },
      // `get(project, id, with: ["payments"])`
      payments: { on: ["project"], load: (ctx, by, limit) => ctx.mod("projects")!.payments.list({ filter: by, limit }).rows.slice(0, limit) },
      // `get(project, id, with: ["files"])`: the uploaded files
      files: { on: ["project"], load: (ctx, by, limit) => filesOf(ctx, "project", by.project_id).slice(0, limit) },
    },
  },
  mcp,
});
