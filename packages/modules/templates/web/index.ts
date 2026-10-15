// The templates module's web part: the manifest the shell builds its route, nav item, form and links from, and its slot on the report page.
import { lazy } from "react";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { TEMPLATES_PATH } from "./paths";

/** Where the template comparison sits among the sections of the report page (the funnel of the pipeline module comes before it) */
const REPORT_SECTION_ORDER = 20;

export default defineWebModule({
  key: "templates",
  label: "Şablonlar",
  routes: [{ page: "templates", path: TEMPLATES_PATH, params: "/:id?", load: () => import("./pages/Templates") }],
  nav: [{ group: "Pazarlama", order: 30, label: "Şablonlar", icon: "template", path: TEMPLATES_PATH }],
  quickAdd: [{
    kind: "template", name: "Şablon", key: "B", dest: "Şablonlar", icon: BOARD_ICON.template, tone: "comment", group: "Pazarlama", order: 30,
    form: { noun: "Şablon", dest: "Şablonlar’a eklenir", icon: BOARD_ICON.template, base: "/templates", editId: (p) => p.template_id, page: byRecord("template") },
    load: () => import("./forms/TemplateForm").then((m) => ({ default: m.TemplateForm })),
  }],
  links: { template: (id) => `${TEMPLATES_PATH}/${id}` },
  slots: { "report.sections": { order: REPORT_SECTION_ORDER, Component: lazy(() => import("./components/ReportCompare")) } },
  invalidates: {
    sectors: ["/templates"],
    templates: ["/templates", "/trash"],
  },
});
