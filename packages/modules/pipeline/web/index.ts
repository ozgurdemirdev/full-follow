// The pipeline module's web part (the manifest); pages, cards and forms are still loaded from the kit.
import { K, useBoard } from "@kit/api/keys";
import type { Opportunity } from "@kit/api/types";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord, linkTo } from "@kit/app/modules/links";
import { opportunityPath, PATHS } from "@kit/app/routes";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { FORM_ICON } from "@kit/components/forms/icons";
import { norm } from "@kit/lib/format";
import { OPEN_STAGES, STAGE } from "@kit/lib/labels";

export default defineWebModule({
  key: "pipeline",
  label: "Satış hunisi",
  routes: [
    { page: "pipeline", path: PATHS.pipeline, params: "/:id?", load: () => import("@kit/pages/Pipeline") },
    { page: "opportunity", path: PATHS.opportunity, params: "/:id", load: () => import("@kit/pages/Opportunity") },
  ],
  nav: [{
    group: "Satış ve projeler", order: 10, label: "Satış hunisi", icon: "funnel", path: PATHS.pipeline,
    useBadge: () => useBoard().rows.filter((o) => OPEN_STAGES.includes(o.stage)).length,
  }],
  dashboard: [
    { id: "funnel", column: 2, order: 110, load: () => import("@kit/components/dash/FunnelCard").then((m) => ({ default: m.FunnelCard })) },
  ],
  quickAdd: [
    {
      kind: "opportunity", name: "Fırsat", key: "S", dest: "Satış hunisi", icon: BOARD_ICON.funnel, tone: "payment", group: "Satış", order: 10,
      form: { noun: "Fırsat", dest: "Satış hunisine eklenir", icon: BOARD_ICON.funnel, base: "/opportunities", editId: (p) => p.edit, page: byRecord("opportunity") },
      load: () => import("@kit/forms/OpportunityForm").then((m) => ({ default: m.OpportunityForm })),
    },
    {
      kind: "offer", name: "Teklif", key: "E", dest: "Fırsata bağlanır", icon: FORM_ICON.offer, tone: "payment", group: "Satış", order: 20,
      form: {
        noun: "Teklif", dest: "Fırsata bağlanır, aşama Teklif olur", icon: FORM_ICON.offer, base: "/offers", ownRead: true, editId: (p) => p.edit,
        page: (_id, pre) => (pre?.opportunity_id ? (linkTo("opportunity", pre.opportunity_id) ?? PATHS.pipeline) : PATHS.pipeline),
      },
      load: () => import("@kit/components/OfferForm").then((m) => ({ default: m.OfferForm })),
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
});
