// The timeline module's web part (the manifest); its page is still loaded from the kit.
import { defineWebModule } from "@kit/app/modules/define";
import { PATHS } from "@kit/app/routes";
import { OpportunityFeed } from "./OpportunityFeed";
import { RecordTimelineLink } from "./RecordTimelineLink";

export default defineWebModule({
  key: "timeline",
  label: "Zaman çizelgesi",
  routes: [{ page: "timeline", path: PATHS.timeline, params: "/:type?/:id?", load: () => import("@kit/pages/Timeline") }],
  nav: [{ group: "Satış ve projeler", order: 40, label: "Zaman çizelgesi", icon: "clock", path: PATHS.timeline }],
  // the link to a record's history on the screens of the people, pipeline and projects modules
  slots: {
    "person.overlay.menu": RecordTimelineLink,
    "person.overlay.side": RecordTimelineLink,
    "opportunity.actions": RecordTimelineLink,
    "opportunity.main": OpportunityFeed,
    "project.detail.actions": RecordTimelineLink,
  },
});
