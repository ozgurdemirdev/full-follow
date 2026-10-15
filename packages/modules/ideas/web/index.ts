// The ideas module's web part (the manifest); pages and forms are still loaded from the kit.
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { PATHS } from "@kit/app/routes";
import { BOARD_ICON } from "@kit/components/boardIcons";

export default defineWebModule({
  key: "ideas",
  label: "Fikirler",
  routes: [{ page: "ideas", path: PATHS.ideas, params: "/:id?", load: () => import("@kit/pages/Ideas") }],
  nav: [{ group: "Pazarlama", order: 20, label: "Gelir fikirleri", icon: "bulb", path: PATHS.ideas }],
  quickAdd: [{
    kind: "idea", name: "Fikir", key: "I", dest: "Gelir fikirleri", icon: BOARD_ICON.bulb, tone: "comment", group: "Pazarlama", order: 20,
    form: { noun: "Fikir", dest: "Gelir fikirlerine eklenir", icon: BOARD_ICON.bulb, base: "/ideas", editId: (p) => p.idea_id, page: byRecord("idea") },
    load: () => import("@kit/forms/MarketingForms").then((m) => ({ default: m.IdeaForm })),
  }],
  links: { idea: (id) => `${PATHS.ideas}/${id}` },
});
