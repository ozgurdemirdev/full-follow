// The ideas module's web part: the manifest the shell builds its route, nav item, form and links from.
import { lazy } from "react";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { PersonIdeas } from "./components/PersonIdeas";
import { m } from "./messages";
import { IDEAS_PATH } from "./paths";
import { m as kit } from "@kit/messages";

/** The idea columns of an own project's overlay (slot of the own projects page) */
const ProjectIdeas = lazy(() => import("./components/ProjectIdeas").then((mod) => ({ default: mod.ProjectIdeas })));

export default defineWebModule({
  key: "ideas",
  label: m.label,
  routes: [{ page: "ideas", path: IDEAS_PATH, params: "/:id?", load: () => import("./pages/Ideas") }],
  nav: [{ group: kit.navGroups.marketing, order: 20, label: m.navLabel, icon: "bulb", path: IDEAS_PATH }],
  quickAdd: [{
    kind: "idea", name: m.noun, key: "I", dest: m.navLabel, icon: BOARD_ICON.bulb, tone: "comment", group: kit.navGroups.marketing, order: 20,
    form: { noun: m.noun, dest: m.addedTo, icon: BOARD_ICON.bulb, base: "/ideas", editId: (p) => p.idea_id, page: byRecord("idea") },
    load: () => import("./forms/IdeaForm").then((mod) => ({ default: mod.IdeaForm })),
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
