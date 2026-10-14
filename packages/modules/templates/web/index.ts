// The templates module's web part (the manifest); pages and forms are still loaded from the kit.
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { PATHS } from "@kit/app/routes";
import { BOARD_ICON } from "@kit/components/boardIcons";

export default defineWebModule({
  key: "templates",
  label: "Şablonlar",
  routes: [{ page: "templates", path: PATHS.templates, params: "/:id?", load: () => import("@kit/pages/Templates") }],
  nav: [{ group: "Pazarlama", order: 30, label: "Şablonlar", icon: "template", path: PATHS.templates }],
  quickAdd: [{
    kind: "template", name: "Şablon", key: "B", dest: "Şablonlar", icon: BOARD_ICON.template, tone: "comment", group: "Pazarlama", order: 30,
    form: { noun: "Şablon", dest: "Şablonlar’a eklenir", icon: BOARD_ICON.template, base: "/templates", editId: (p) => p.template_id, page: byRecord("template") },
    load: () => import("@kit/forms/MarketingForms").then((m) => ({ default: m.TemplateForm })),
  }],
  links: { template: (id) => `${PATHS.templates}/${id}` },
});
