// The timeline module's web part: the manifest the shell builds its route and nav item from, and the feed it gives the opportunity page.
import { lazy } from "react";
import { defineWebModule } from "@kit/app/modules/define";
import { TIMELINE_PATH } from "./paths";

export default defineWebModule({
  key: "timeline",
  label: "Zaman çizelgesi",
  routes: [{ page: "timeline", path: TIMELINE_PATH, params: "/:type?/:id?", load: () => import("./pages/Timeline") }],
  nav: [{ group: "Satış ve projeler", order: 40, label: "Zaman çizelgesi", icon: "clock", path: TIMELINE_PATH }],
  slots: { "opportunity.feed": lazy(() => import("./components/OpportunityFeed")) },
  invalidates: {
    notes: ["/timeline"],
    links: ["/timeline"],
    offers: ["/timeline"],
    files: ["/timeline"],
    "opportunity-people": ["/timeline"],
    opportunities: ["/timeline"],
    projects: ["/timeline"],
    payments: ["/timeline"],
    comments: ["/timeline"],
    people: ["/timeline"],
    companies: ["/timeline"],
    touches: ["/timeline"],
  },
});
