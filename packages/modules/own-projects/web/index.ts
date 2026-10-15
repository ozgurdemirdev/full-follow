// The own projects module's web part (the manifest); pages, cards and forms are still loaded from the kit.
import { lazy } from "react";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { PATHS } from "@kit/app/routes";
import { BOARD_ICON } from "@kit/components/boardIcons";

export default defineWebModule({
  key: "own-projects",
  label: "Kendi projelerim",
  routes: [{ page: "ownProjects", path: PATHS.ownProjects, params: "/:id?", load: () => import("@kit/pages/OwnProjects") }],
  nav: [{ group: "Satış ve projeler", order: 30, label: "Kendi projelerim", icon: "cube", path: PATHS.ownProjects }],
  dashboard: [
    // the same card as the projects module's (it lists both kinds): whichever module is there registers it, the first one wins
    { id: "projects", column: 2, order: 100, load: () => import("@kit/components/dash/ProjectsCard").then((m) => ({ default: m.ProjectsCard })) },
  ],
  quickAdd: [{
    kind: "own_project", name: "Kendi projem", key: "O", dest: "Kendi projelerim", icon: BOARD_ICON.cube, tone: "neutral", group: "Kendi işlerin", order: 10,
    form: {
      noun: "Kendi projem", dest: "Kendi projelerim’e eklenir", icon: BOARD_ICON.cube, base: "/own-projects", editId: (p) => p.own_project_id,
      page: byRecord("own_project"),
    },
    load: () => import("@kit/forms/OwnProjectForm").then((m) => ({ default: m.OwnProjectForm })),
  }],
  links: { own_project: (id) => `${PATHS.ownProjects}/${id}` },
  slots: { "idea.actions": lazy(() => import("./slots/IdeaToProject")) },
});
