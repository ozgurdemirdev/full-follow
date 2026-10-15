// The timeline module's web part: the manifest the shell builds its route and nav item from, the feed it gives the opportunity page
// and the link to a record's history it gives the screens of the people, pipeline and projects modules.
import { lazy } from "react";
import { defineWebModule } from "@kit/app/modules/define";
import { m } from "./messages";
import { TIMELINE_PATH } from "./paths";
import { RecordTimelineLink } from "./RecordTimelineLink";

export default defineWebModule({
  key: "timeline",
  label: m.label,
  routes: [{ page: "timeline", path: TIMELINE_PATH, params: "/:type?/:id?", load: () => import("./pages/Timeline") }],
  nav: [{ group: m.shared.salesAndProjects, order: 40, label: m.label, icon: "clock", path: TIMELINE_PATH }],
  slots: {
    "opportunity.feed": lazy(() => import("./components/OpportunityFeed")),
    "person.overlay.menu": RecordTimelineLink,
    "person.overlay.side": RecordTimelineLink,
    "opportunity.actions": RecordTimelineLink,
    "project.detail.actions": RecordTimelineLink,
  },
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
