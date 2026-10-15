// The projects module's web part: the manifest the shell builds its route, nav item, dashboard cards, form and search from.
import { lazy } from "react";
import { K } from "@kit/api/keys";
import type { Project } from "@kit/api/types";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { norm } from "@kit/lib/format";
import { PROJECT_STAGE } from "@kit/lib/labels";
import { CompanyProjects, PersonProjects } from "./components/ProjectRows";
import { PROJECTS_PATH } from "./paths";

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
  // the projects on a person's and a company's overlay, and the side card of the timeline
  slots: {
    "person.overlay.deals": { order: 30, Component: PersonProjects },
    "company.overlay.work": { order: 10, Component: CompanyProjects },
    "timeline.aside": { order: 10, Component: lazy(() => import("./slots/TimelineProject")) },
  },
  invalidates: {
    projects: ["/projects", "/timeline", "/today", "/payments", "/trash"],
    payments: ["/payments", "/projects", "/today", "/report", "/timeline", "/trash"],
  },
});
