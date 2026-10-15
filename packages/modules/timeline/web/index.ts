// The timeline module's web part (the manifest); its page is still loaded from the kit.
import { defineWebModule } from "@kit/app/modules/define";
import { PATHS } from "@kit/app/routes";

export default defineWebModule({
  key: "timeline",
  label: "Zaman çizelgesi",
  routes: [{ page: "timeline", path: PATHS.timeline, params: "/:type?/:id?", load: () => import("@kit/pages/Timeline") }],
  nav: [{ group: "Satış ve projeler", order: 40, label: "Zaman çizelgesi", icon: "clock", path: PATHS.timeline }],
});
