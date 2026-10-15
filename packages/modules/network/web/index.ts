// The network module's web part: no page of its own. It brings the touch form, the contact cards of the dashboard, its settings rows and the
// touches of the people and companies screens (the stream of a person, the touches of a company, the loose touches under the company tiles).
import { CONTACT_DATA } from "@kit/api/contacts";
import { defineWebModule } from "@kit/app/modules/define";
import { PATHS } from "@kit/app/routes";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { CompanyTouches } from "./components/CompanyTouches";
import { LooseTouches } from "./components/LooseTouches";
import { PersonStream } from "./components/PersonStream";
import { followWaitRows, weeklyTargetRows } from "./settings";

export default defineWebModule({
  key: "network",
  label: "Temaslar",
  dashboard: [
    { id: "awaiting", column: 1, order: 40, show: (t) => !!t.network, load: () => import("./cards").then((m) => ({ default: m.AwaitingDashCard })) },
    { id: "activity", column: 1, order: 80, load: () => import("./cards/ActivityCard").then((m) => ({ default: m.ActivityCard })) },
    { id: "cooling", column: 2, order: 120, show: (t) => !!t.network?.cooling.rows.length, load: () => import("./cards").then((m) => ({ default: m.CoolingDashCard })) },
    { id: "status", order: 150, load: () => import("./cards/StatusCard").then((m) => ({ default: m.StatusCard })) },
  ],
  settings: [
    { id: "follow-wait", category: "takip", order: 5, rows: followWaitRows },
    { id: "weekly-target", category: "isletme", order: 20, rows: weeklyTargetRows },
  ],
  quickAdd: [{
    kind: "touch", name: "Temas", key: "T", dest: "Kişinin zaman çizelgesi", icon: BOARD_ICON.comment, tone: "info", group: "Kişiler ve iletişim", order: 30,
    form: { noun: "Temas", dest: "Kişinin zaman çizelgesine eklenir", icon: BOARD_ICON.comment, base: "/touches", editId: (p) => p.edit, page: () => PATHS.timeline },
    load: () => import("./forms/TouchForm").then((m) => ({ default: m.TouchForm })),
  }],
  slots: {
    "person.overlay.main": PersonStream,
    "company.overlay.main": { order: 20, Component: CompanyTouches },
    "companies.page.after": LooseTouches,
  },
  invalidates: { touches: [...CONTACT_DATA, "/opportunities", "/ideas", "/followups", "/trash"] },
});
