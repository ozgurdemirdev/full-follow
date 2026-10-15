// The pipeline module's web part: the manifest the shell builds its routes, nav item, dashboard card, forms and search from.
import { lazy } from "react";
import { useBoard } from "@kit/api/keys";
import type { Opportunity } from "@kit/api/types";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord, linkTo } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { FORM_ICON } from "@kit/components/forms/icons";
import { OPEN_STAGES, STAGE } from "@kit/lib/labels";
import { CompanyOpportunities, PersonOpenDeal, PersonOpportunities } from "./components/PersonDeals";
import { m } from "./messages";
import { opportunityPath, OPPORTUNITY_PATH, PIPELINE_PATH } from "./paths";
import { m as kit } from "@kit/messages";

export default defineWebModule({
  key: "pipeline",
  label: m.label,
  routes: [
    { page: "pipeline", path: PIPELINE_PATH, params: "/:id?", load: () => import("./pages/Pipeline") },
    { page: "opportunity", path: OPPORTUNITY_PATH, params: "/:id", load: () => import("./pages/Opportunity") },
  ],
  nav: [{
    group: kit.navGroups.salesProjects, order: 10, label: m.label, icon: "funnel", path: PIPELINE_PATH,
    useBadge: () => useBoard().rows.filter((o) => OPEN_STAGES.includes(o.stage)).length,
  }],
  dashboard: [
    { id: "funnel", column: 2, order: 110, load: () => import("./cards/FunnelCard").then((mod) => ({ default: mod.FunnelCard })) },
  ],
  quickAdd: [
    {
      kind: "opportunity", name: m.noun, key: "S", dest: m.label, icon: BOARD_ICON.funnel, tone: "payment", group: kit.quickGroups.sales, order: 10,
      form: { noun: m.noun, dest: m.addedTo, icon: BOARD_ICON.funnel, base: "/opportunities", editId: (p) => p.edit, page: byRecord("opportunity") },
      load: () => import("./forms/OpportunityForm").then((mod) => ({ default: mod.OpportunityForm })),
    },
    {
      kind: "offer", name: m.offerNoun, key: "E", dest: m.offerDest, icon: FORM_ICON.offer, tone: "payment", group: kit.quickGroups.sales, order: 20,
      form: {
        noun: m.offerNoun, dest: m.offerAddedTo, icon: FORM_ICON.offer, base: "/offers", ownRead: true, editId: (p) => p.edit,
        page: (_id, pre) => (pre?.opportunity_id ? (linkTo("opportunity", pre.opportunity_id) ?? PIPELINE_PATH) : PIPELINE_PATH),
      },
      load: () => import("./forms/OfferForm").then((mod) => ({ default: mod.OfferForm })),
    },
  ],
  links: { opportunity: opportunityPath },
  search: [{
    id: "opportunities", order: 20, path: "/opportunities",
    hit: (o: Opportunity) => ({ key: `o${o.id}`, label: o.title, sub: m.searchSub(STAGE[o.stage], o.person_name), href: opportunityPath(o.id) }),
  }],
  // the opportunities on a person's and a company's overlay (rows, and the open deal fact); the funnel report section; the side cards of the timeline and the posts
  slots: {
    "person.overlay.deals": { order: 20, Component: PersonOpportunities },
    "person.overlay.facts": PersonOpenDeal,
    "company.overlay.work": { order: 20, Component: CompanyOpportunities },
    "report.sections": { order: 10, Component: lazy(() => import("./components/SourceFunnel")) },
    "timeline.aside": { order: 10, Component: lazy(() => import("./slots/TimelineOpportunity")) },
    "post.overlay.side": { order: 20, Component: lazy(() => import("./slots/PostOpps")) },
  },
  invalidates: {
    offers: ["/opportunities", "/timeline", "/trash"],
    "opportunity-people": ["/opportunities", "/timeline", "/trash"],
    opportunities: ["/opportunities", "/today", "/timeline", "/projects", "/people", "/companies", "/report", "/payments", "/sources", "/trash"],
  },
});
