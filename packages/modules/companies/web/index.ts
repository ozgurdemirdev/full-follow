// The companies module's web part: the manifest the shell builds its route, nav item and form from.
import { CONTACT_DATA } from "@kit/api/contacts";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { COMPANIES_PATH } from "./paths";

export default defineWebModule({
  key: "companies",
  label: "Firmalar",
  routes: [{ page: "companies", path: COMPANIES_PATH, params: "/:id?", load: () => import("./pages/Companies") }],
  nav: [{ group: "Network", order: 40, label: "Firmalar", icon: "building", path: COMPANIES_PATH }],
  quickAdd: [{
    kind: "company", name: "Firma", key: "F", dest: "Firmalar", icon: BOARD_ICON.building, tone: "source", group: "Kişiler ve iletişim", order: 20,
    form: { noun: "Firma", dest: "Firmalar’a eklenir", icon: BOARD_ICON.building, base: "/companies", editId: (p) => p.edit, page: byRecord("company") },
    load: () => import("./forms/CompanyForm").then((m) => ({ default: m.CompanyForm })),
  }],
  links: { company: (id) => `${COMPANIES_PATH}/${id}` },
  invalidates: { companies: [...CONTACT_DATA, "/opportunities", "/sectors", "/tags", "/sources", "/drafts", "/trash"] },
});
