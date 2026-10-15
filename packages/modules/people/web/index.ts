// The people module's web part: the manifest the shell builds its route, nav item, dashboard card, form and search from.
// It also fills the company overlay with the people inside the company (slot "company.overlay.main").
import { K } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import { CONTACT_DATA } from "@kit/api/contacts";
import type { Person, Today } from "@kit/api/types";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { FORM_ICON } from "@kit/components/forms/icons";
import { norm } from "@kit/lib/format";
import { OrgPeople } from "./components/OrgPeople";
import { PEOPLE_PATH } from "./paths";

const followUpCount = (t: Today) => (t.follow_ups?.people?.total ?? 0) + (t.follow_ups?.opportunities?.total ?? 0);

export default defineWebModule({
  key: "people",
  label: "Kişiler",
  routes: [{ page: "people", path: PEOPLE_PATH, params: "/:id?", load: () => import("./pages/People") }],
  nav: [{
    group: "Network", order: 30, label: "Kişiler", icon: "users", path: PEOPLE_PATH,
    useBadge: () => useQuery<Today>(K.today).data?.network?.awaiting.total,
  }],
  dashboard: [
    { id: "follow-ups", order: 60, show: (t) => followUpCount(t) > 0, load: () => import("./cards").then((m) => ({ default: m.FollowUpsDashCard })) },
  ],
  quickAdd: [{
    kind: "person", name: "Kişi", key: "K", dest: "Kişiler", icon: BOARD_ICON.users, tone: "info", group: "Kişiler ve iletişim", order: 10,
    form: { noun: "Kişi", dest: "Kişiler’e eklenir", icon: FORM_ICON.userPlus, base: "/people", editId: (p) => p.person_id, page: byRecord("person") },
    load: () => import("./forms/PersonForm").then((m) => ({ default: m.PersonForm })),
  }],
  links: { person: (id) => `${PEOPLE_PATH}/${id}` },
  search: [{
    id: "people", order: 10, dataKey: K.people,
    match: (p: Person, q, ctx) => (
      norm(p.name).includes(q) || norm(p.company_name).includes(q) || norm(p.email).includes(q) || norm(p.handle).includes(q)
        ? { key: `p${p.id}`, label: p.name, sub: p.company_name ?? "Kişi", href: ctx.recordHref("person", p.id) }
        : null
    ),
  }],
  slots: { "company.overlay.main": { order: 10, Component: OrgPeople } },
  invalidates: { people: [...CONTACT_DATA, "/opportunities", "/sectors", "/tags", "/sources", "/report", "/posts", "/ideas", "/trash"] },
});
