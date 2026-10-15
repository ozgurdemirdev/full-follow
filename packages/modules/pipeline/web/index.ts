// The pipeline module's web part: the manifest the shell builds its routes, nav item, dashboard card, forms and search from.
import { K, useBoard } from "@kit/api/keys";
import type { Opportunity } from "@kit/api/types";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord, linkTo } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { FORM_ICON } from "@kit/components/forms/icons";
import { norm } from "@kit/lib/format";
import { OPEN_STAGES, STAGE } from "@kit/lib/labels";
import { CompanyOpportunities, PersonOpenDeal, PersonOpportunities } from "./components/PersonDeals";
import { opportunityPath, OPPORTUNITY_PATH, PIPELINE_PATH } from "./paths";

export default defineWebModule({
  key: "pipeline",
  label: "Satış hunisi",
  routes: [
    { page: "pipeline", path: PIPELINE_PATH, params: "/:id?", load: () => import("./pages/Pipeline") },
    { page: "opportunity", path: OPPORTUNITY_PATH, params: "/:id", load: () => import("./pages/Opportunity") },
  ],
  nav: [{
    group: "Satış ve projeler", order: 10, label: "Satış hunisi", icon: "funnel", path: PIPELINE_PATH,
    useBadge: () => useBoard().rows.filter((o) => OPEN_STAGES.includes(o.stage)).length,
  }],
  dashboard: [
    { id: "funnel", column: 2, order: 110, load: () => import("./cards/FunnelCard").then((m) => ({ default: m.FunnelCard })) },
  ],
  quickAdd: [
    {
      kind: "opportunity", name: "Fırsat", key: "S", dest: "Satış hunisi", icon: BOARD_ICON.funnel, tone: "payment", group: "Satış", order: 10,
      form: { noun: "Fırsat", dest: "Satış hunisine eklenir", icon: BOARD_ICON.funnel, base: "/opportunities", editId: (p) => p.edit, page: byRecord("opportunity") },
      load: () => import("./forms/OpportunityForm").then((m) => ({ default: m.OpportunityForm })),
    },
    {
      kind: "offer", name: "Teklif", key: "E", dest: "Fırsata bağlanır", icon: FORM_ICON.offer, tone: "payment", group: "Satış", order: 20,
      form: {
        noun: "Teklif", dest: "Fırsata bağlanır, aşama Teklif olur", icon: FORM_ICON.offer, base: "/offers", ownRead: true, editId: (p) => p.edit,
        page: (_id, pre) => (pre?.opportunity_id ? (linkTo("opportunity", pre.opportunity_id) ?? PIPELINE_PATH) : PIPELINE_PATH),
      },
      load: () => import("./forms/OfferForm").then((m) => ({ default: m.OfferForm })),
    },
  ],
  links: { opportunity: opportunityPath },
  search: [{
    id: "opportunities", order: 20, dataKey: K.opps,
    match: (o: Opportunity, q) => (
      norm(o.title).includes(q) || norm(o.person_name).includes(q)
        ? { key: `o${o.id}`, label: o.title, sub: `Fırsat · ${STAGE[o.stage]} · ${o.person_name}`, href: opportunityPath(o.id) }
        : null
    ),
  }],
  // the opportunities on a person's and a company's overlay (rows, and the open deal fact)
  slots: {
    "person.overlay.deals": { order: 20, Component: PersonOpportunities },
    "person.overlay.facts": PersonOpenDeal,
    "company.overlay.work": { order: 20, Component: CompanyOpportunities },
  },
  invalidates: {
    offers: ["/opportunities", "/timeline", "/trash"],
    "opportunity-people": ["/opportunities", "/timeline", "/trash"],
    opportunities: ["/opportunities", "/today", "/timeline", "/projects", "/people", "/companies", "/report", "/payments", "/sources", "/trash"],
  },
});
