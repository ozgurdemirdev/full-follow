// The network module's web part: no page of its own. It brings the touch form, the contact cards of the dashboard, its settings rows and the
// touches of the people and companies screens (the stream of a person, the touches of a company, the loose touches under the company tiles).
import { CONTACT_DATA } from "@kit/api/contacts";
import { defineWebModule } from "@kit/app/modules/define";
import { pageTo } from "@kit/app/modules/links";
import { PATHS } from "@kit/app/routes";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { CompanyTouches } from "./components/CompanyTouches";
import { LooseTouches } from "./components/LooseTouches";
import { PersonStream } from "./components/PersonStream";
import { m } from "./messages";
import { followWaitRows, weeklyTargetRows } from "./settings";
import { m as kit } from "@kit/messages";

export default defineWebModule({
  key: "network",
  label: m.label,
  dashboard: [
    { id: "awaiting", column: 1, order: 40, show: (t) => !!t.network, load: () => import("./cards").then((mod) => ({ default: mod.AwaitingDashCard })) },
    { id: "activity", column: 1, order: 80, load: () => import("./cards/ActivityCard").then((mod) => ({ default: mod.ActivityCard })) },
    { id: "cooling", column: 2, order: 120, show: (t) => !!t.network?.cooling.rows.length, load: () => import("./cards").then((mod) => ({ default: mod.CoolingDashCard })) },
    { id: "status", order: 150, load: () => import("./cards/StatusCard").then((mod) => ({ default: mod.StatusCard })) },
  ],
  settings: [
    { id: "follow-wait", category: "takip", order: 5, rows: followWaitRows },
    { id: "weekly-target", category: "isletme", order: 20, rows: weeklyTargetRows },
  ],
  quickAdd: [{
    kind: "touch", name: m.noun, key: "T", dest: m.dest, icon: BOARD_ICON.comment, tone: "info", group: kit.quickGroups.people, order: 30,
    form: { noun: m.noun, dest: m.addedTo, icon: BOARD_ICON.comment, base: "/touches", editId: (p) => p.edit, page: () => pageTo("timeline") ?? PATHS.today },
    load: () => import("./forms/TouchForm").then((mod) => ({ default: mod.TouchForm })),
  }],
  slots: {
    "person.overlay.main": PersonStream,
    "company.overlay.main": { order: 20, Component: CompanyTouches },
    "companies.page.after": LooseTouches,
  },
  invalidates: { touches: [...CONTACT_DATA, "/opportunities", "/ideas", "/followups", "/trash"] },
});
