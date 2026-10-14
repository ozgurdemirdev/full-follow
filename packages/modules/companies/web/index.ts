// The companies module's web part (the manifest); pages and forms are still loaded from the kit.
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { PATHS } from "@kit/app/routes";
import { BOARD_ICON } from "@kit/components/boardIcons";

export default defineWebModule({
  key: "companies",
  label: "Firmalar",
  routes: [{ page: "companies", path: PATHS.companies, params: "/:id?", load: () => import("@kit/pages/Companies") }],
  nav: [{ group: "Network", order: 40, label: "Firmalar", icon: "building", path: PATHS.companies }],
  quickAdd: [{
    kind: "company", name: "Firma", key: "F", dest: "Firmalar", icon: BOARD_ICON.building, tone: "source", group: "Kişiler ve iletişim", order: 20,
    form: { noun: "Firma", dest: "Firmalar’a eklenir", icon: BOARD_ICON.building, base: "/companies", editId: (p) => p.edit, page: byRecord("company") },
    load: () => import("@kit/forms/ContactForms").then((m) => ({ default: m.CompanyForm })),
  }],
  links: { company: (id) => `${PATHS.companies}/${id}` },
});
