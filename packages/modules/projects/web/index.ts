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
import { m } from "./messages";
import { PROJECTS_PATH } from "./paths";
import { m as kit } from "@kit/messages";

export default defineWebModule({
  key: "projects",
  label: m.label,
  routes: [{ page: "projects", path: PROJECTS_PATH, params: "/:id?", load: () => import("./pages/Projects") }],
  nav: [{ group: kit.navGroups.salesProjects, order: 20, label: m.navLabel, icon: "folder", path: PROJECTS_PATH }],
  dashboard: [
    { id: "payments", column: 1, order: 70, load: () => import("./cards/PaymentsCard").then((mod) => ({ default: mod.PaymentsCard })) },
    // one card for both project lists (it stays in the kit, the own-projects module registers it too): the first one wins
    { id: "projects", column: 2, order: 100, load: () => import("@kit/components/dash/ProjectsCard").then((mod) => ({ default: mod.ProjectsCard })) },
  ],
  quickAdd: [{
    kind: "project", name: m.noun, key: "P", dest: m.navLabel, icon: BOARD_ICON.folder, tone: "accent", group: kit.quickGroups.sales, order: 30,
    form: { noun: m.noun, dest: m.addedTo, icon: BOARD_ICON.folder, base: "/projects", page: byRecord("project") },
    load: () => import("./forms/ProjectForm").then((mod) => ({ default: mod.ProjectForm })),
  }],
  links: { project: (id) => `${PROJECTS_PATH}/${id}` },
  search: [{
    id: "projects", order: 30, dataKey: K.projects,
    match: (p: Project, q, ctx) => (
      norm(p.name).includes(q) || norm(p.person_name).includes(q)
        ? { key: `r${p.id}`, label: p.name, sub: m.searchSub(PROJECT_STAGE[p.stage]), href: ctx.recordHref("project", p.id) }
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
