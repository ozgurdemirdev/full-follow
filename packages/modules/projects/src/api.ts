import type { Ctx, ProjectsApi } from "@fullfollow/core";
import { projectsServices } from "./service";
import { countOf, forOpportunity, idsForOpportunities, moneyByCompany, namesOf, paymentGet, paymentList, paymentRef, paymentsDue, personStats, projectGet, projectList, projectRef } from "./service/list";
import { collectedIn, outstandingDue } from "./service/payments";

/** The projects module's implementation of its contract (`ProjectsApi` in core's contracts) */
export function projectsApi(ctx: Ctx): ProjectsApi {
  const { projects, payments } = projectsServices(ctx);
  return {
    projects: {
      // rows come from text and enum columns; the contract narrows what the schema keeps loose
      create: projects.create as ProjectsApi["projects"]["create"],
      update: projects.update as ProjectsApi["projects"]["update"],
      move: projects.move as ProjectsApi["projects"]["move"],
      remove: projects.remove,
      list: (opts) => projectList(ctx, opts),
      get: (id) => projectGet(ctx, id),
      ref: (id) => projectRef(ctx, id),
      names: (ids) => namesOf(ctx, ids),
      forOpportunity: (opportunityId) => forOpportunity(ctx, opportunityId),
      idsForOpportunities: (ids) => idsForOpportunities(ctx, ids),
      countOf: (personId) => countOf(ctx, personId),
    },
    payments: {
      create: payments.create as ProjectsApi["payments"]["create"],
      update: payments.update as ProjectsApi["payments"]["update"],
      pay: payments.pay as ProjectsApi["payments"]["pay"],
      remove: payments.remove,
      list: (opts) => paymentList(ctx, opts),
      get: (id) => paymentGet(ctx, id),
      ref: (id) => paymentRef(ctx, id),
      due: (from, to) => paymentsDue(ctx, from, to),
    },
    collectedIn: (ym) => collectedIn(ctx, ym),
    outstandingDue: (ym) => outstandingDue(ctx, ym),
    personStats: () => personStats(ctx),
    moneyByCompany: () => moneyByCompany(ctx),
  };
}
