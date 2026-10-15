// The own projects module's web part: the manifest the shell builds its route, nav item, dashboard card and form from.
import { lazy } from "react";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { OWN_PROJECTS_PATH } from "./paths";

export default defineWebModule({
  key: "own-projects",
  label: "Kendi projelerim",
  routes: [{ page: "ownProjects", path: OWN_PROJECTS_PATH, params: "/:id?", load: () => import("./pages/OwnProjects") }],
  nav: [{ group: "Satış ve projeler", order: 30, label: "Kendi projelerim", icon: "cube", path: OWN_PROJECTS_PATH }],
  dashboard: [
    // the same card as the projects module's (it lists both kinds, so it stays in the kit): whichever module is there registers it, the first one wins
    { id: "projects", column: 2, order: 100, load: () => import("@kit/components/dash/ProjectsCard").then((m) => ({ default: m.ProjectsCard })) },
  ],
  quickAdd: [{
    kind: "own_project", name: "Kendi projem", key: "O", dest: "Kendi projelerim", icon: BOARD_ICON.cube, tone: "neutral", group: "Kendi işlerin", order: 10,
    form: {
      noun: "Kendi projem", dest: "Kendi projelerim’e eklenir", icon: BOARD_ICON.cube, base: "/own-projects", editId: (p) => p.own_project_id,
      page: byRecord("own_project"),
    },
    load: () => import("./forms/OwnProjectForm").then((m) => ({ default: m.OwnProjectForm })),
  }],
  links: { own_project: (id) => `${OWN_PROJECTS_PATH}/${id}` },
  slots: { "idea.actions": lazy(() => import("./slots/IdeaToProject")) },
  invalidates: { "own-projects": ["/own-projects", "/ideas", "/links", "/comments", "/trash"] },
});
