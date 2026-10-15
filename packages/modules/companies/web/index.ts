// The companies module's web part: the manifest the shell builds its route, nav item and form from.
import { CONTACT_DATA } from "@kit/api/contacts";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { m as kit } from "@kit/messages";
import { m } from "./messages";
import { COMPANIES_PATH } from "./paths";

export default defineWebModule({
  key: "companies",
  label: kit.nouns.companies,
  routes: [{ page: "companies", path: COMPANIES_PATH, params: "/:id?", load: () => import("./pages/Companies") }],
  nav: [{ group: kit.navGroups.network, order: 40, label: kit.nouns.companies, icon: "building", path: COMPANIES_PATH }],
  quickAdd: [{
    kind: "company", name: kit.nouns.company, key: "F", dest: kit.nouns.companies, icon: BOARD_ICON.building, tone: "source", group: kit.quickGroups.people, order: 20,
    form: { noun: kit.nouns.company, dest: m.formAddedTo, icon: BOARD_ICON.building, base: "/companies", editId: (p) => p.edit, page: byRecord("company") },
    load: () => import("./forms/CompanyForm").then((mod) => ({ default: mod.CompanyForm })),
  }],
  links: { company: (id) => `${COMPANIES_PATH}/${id}` },
  invalidates: { companies: [...CONTACT_DATA, "/opportunities", "/sectors", "/tags", "/sources", "/drafts", "/trash"] },
});
