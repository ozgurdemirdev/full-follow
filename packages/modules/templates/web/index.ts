// The templates module's web part: the manifest the shell builds its route, nav item, form and links from, and its slot on the report page.
import { lazy } from "react";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { m } from "./messages";
import { TEMPLATES_PATH } from "./paths";

/** Where the template comparison sits among the sections of the report page (the funnel of the pipeline module comes before it) */
const REPORT_SECTION_ORDER = 20;

export default defineWebModule({
  key: "templates",
  label: m.label,
  routes: [{ page: "templates", path: TEMPLATES_PATH, params: "/:id?", load: () => import("./pages/Templates") }],
  nav: [{ group: m.shared.marketing, order: 30, label: m.label, icon: "template", path: TEMPLATES_PATH }],
  quickAdd: [{
    kind: "template", name: m.noun, key: "B", dest: m.label, icon: BOARD_ICON.template, tone: "comment", group: m.shared.marketing, order: 30,
    form: { noun: m.noun, dest: m.addedTo, icon: BOARD_ICON.template, base: "/templates", editId: (p) => p.template_id, page: byRecord("template") },
    load: () => import("./forms/TemplateForm").then((mod) => ({ default: mod.TemplateForm })),
  }],
  links: { template: (id) => `${TEMPLATES_PATH}/${id}` },
  slots: { "report.sections": { order: REPORT_SECTION_ORDER, Component: lazy(() => import("./components/ReportCompare")) } },
  invalidates: {
    sectors: ["/templates"],
    templates: ["/templates", "/trash"],
  },
});
