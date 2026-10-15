// The own projects module's web part: the manifest the shell builds its route, nav item, dashboard card and form from.
import { lazy } from "react";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { m as kit } from "@kit/messages";
import { m } from "./messages";
import { OWN_PROJECTS_PATH } from "./paths";

export default defineWebModule({
  key: "own-projects",
  label: m.label,
  routes: [{ page: "ownProjects", path: OWN_PROJECTS_PATH, params: "/:id?", load: () => import("./pages/OwnProjects") }],
  nav: [{ group: kit.navGroups.salesProjects, order: 30, label: m.label, icon: "cube", path: OWN_PROJECTS_PATH }],
  dashboard: [
    // the same card as the projects module's (it lists both kinds, so it stays in the kit): whichever module is there registers it, the first one wins
    { id: "projects", column: 2, order: 100, load: () => import("@kit/components/dash/ProjectsCard").then((mod) => ({ default: mod.ProjectsCard })) },
  ],
  quickAdd: [{
    kind: "own_project", name: m.quickAdd.name, key: "O", dest: m.quickAdd.dest, icon: BOARD_ICON.cube, tone: "neutral", group: kit.quickGroups.own, order: 10,
    form: {
      noun: m.quickAdd.name, dest: m.quickAdd.formDest, icon: BOARD_ICON.cube, base: "/own-projects", editId: (p) => p.own_project_id,
      page: byRecord("own_project"),
    },
    load: () => import("./forms/OwnProjectForm").then((mod) => ({ default: mod.OwnProjectForm })),
  }],
  links: { own_project: (id) => `${OWN_PROJECTS_PATH}/${id}` },
  slots: { "idea.actions": lazy(() => import("./slots/IdeaToProject")) },
  invalidates: { "own-projects": ["/own-projects", "/ideas", "/links", "/comments", "/trash"] },
});
