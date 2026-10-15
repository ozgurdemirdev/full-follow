// The projects module's web part: the manifest the shell builds its route, nav item, dashboard cards, form, settings row and search from.
import { K } from "@kit/api/keys";
import type { Project } from "@kit/api/types";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { norm } from "@kit/lib/format";
import { PROJECT_STAGE } from "@kit/lib/labels";
import { PROJECTS_PATH } from "./paths";
import { paymentTemplateRows } from "./settings";

export default defineWebModule({
  key: "projects",
  label: "Projeler",
  routes: [{ page: "projects", path: PROJECTS_PATH, params: "/:id?", load: () => import("./pages/Projects") }],
  nav: [{ group: "Satış ve projeler", order: 20, label: "Müşteri projeleri", icon: "folder", path: PROJECTS_PATH }],
  dashboard: [
    { id: "payments", column: 1, order: 70, load: () => import("./cards/PaymentsCard").then((m) => ({ default: m.PaymentsCard })) },
    // one card for both project lists (it stays in the kit, the own-projects module registers it too): the first one wins
    { id: "projects", column: 2, order: 100, load: () => import("@kit/components/dash/ProjectsCard").then((m) => ({ default: m.ProjectsCard })) },
  ],
  settings: [{ id: "payment-template", category: "isletme", order: 40, rows: paymentTemplateRows }],
  quickAdd: [{
    kind: "project", name: "Proje", key: "P", dest: "Müşteri projeleri", icon: BOARD_ICON.folder, tone: "accent", group: "Satış", order: 30,
    form: { noun: "Proje", dest: "Müşteri projelerine eklenir", icon: BOARD_ICON.folder, base: "/projects", page: byRecord("project") },
    load: () => import("./forms/ProjectForm").then((m) => ({ default: m.ProjectForm })),
  }],
  links: { project: (id) => `${PROJECTS_PATH}/${id}` },
  search: [{
    id: "projects", order: 30, dataKey: K.projects,
    match: (p: Project, q, ctx) => (
      norm(p.name).includes(q) || norm(p.person_name).includes(q)
        ? { key: `r${p.id}`, label: p.name, sub: `Proje · ${PROJECT_STAGE[p.stage]}`, href: ctx.recordHref("project", p.id) }
        : null
    ),
  }],
  invalidates: {
    projects: ["/projects", "/timeline", "/today", "/payments", "/trash"],
    payments: ["/payments", "/projects", "/today", "/report", "/timeline", "/trash"],
  },
});
