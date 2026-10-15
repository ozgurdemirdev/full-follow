// The ideas module's web part: the manifest the shell builds its route, nav item, form and links from.
import { lazy } from "react";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { PersonIdeas } from "./components/PersonIdeas";
import { IDEAS_PATH } from "./paths";

/** The idea columns of an own project's overlay (slot of the own projects page) */
const ProjectIdeas = lazy(() => import("./components/ProjectIdeas").then((m) => ({ default: m.ProjectIdeas })));

export default defineWebModule({
  key: "ideas",
  label: "Fikirler",
  routes: [{ page: "ideas", path: IDEAS_PATH, params: "/:id?", load: () => import("./pages/Ideas") }],
  nav: [{ group: "Pazarlama", order: 20, label: "Gelir fikirleri", icon: "bulb", path: IDEAS_PATH }],
  quickAdd: [{
    kind: "idea", name: "Fikir", key: "I", dest: "Gelir fikirleri", icon: BOARD_ICON.bulb, tone: "comment", group: "Pazarlama", order: 20,
    form: { noun: "Fikir", dest: "Gelir fikirlerine eklenir", icon: BOARD_ICON.bulb, base: "/ideas", editId: (p) => p.idea_id, page: byRecord("idea") },
    load: () => import("./forms/IdeaForm").then((m) => ({ default: m.IdeaForm })),
  }],
  links: { idea: (id) => `${IDEAS_PATH}/${id}` },
  slots: {
    "own-project.overlay.ideas": { Component: ProjectIdeas },
    "person.overlay.marketing": { order: 20, Component: PersonIdeas },
  },
  invalidates: {
    people: ["/ideas"],
    sectors: ["/ideas"],
    touches: ["/ideas"],
    ideas: ["/ideas", "/own-projects", "/people", "/posts", "/touches", "/timeline", "/trash"],
    "own-projects": ["/ideas"],
  },
});
