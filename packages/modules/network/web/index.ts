// The network module's web part (the manifest): no page of its own; it brings the touch form and the contact cards of the dashboard.
import { defineWebModule } from "@kit/app/modules/define";
import { PATHS } from "@kit/app/routes";
import { BOARD_ICON } from "@kit/components/boardIcons";

export default defineWebModule({
  key: "network",
  label: "Temaslar",
  dashboard: [
    { id: "awaiting", column: 1, order: 40, show: (t) => !!t.network, load: () => import("./cards").then((m) => ({ default: m.AwaitingDashCard })) },
    { id: "activity", column: 1, order: 80, load: () => import("@kit/components/dash/ActivityCard").then((m) => ({ default: m.ActivityCard })) },
    { id: "cooling", column: 2, order: 120, show: (t) => !!t.network?.cooling.rows.length, load: () => import("./cards").then((m) => ({ default: m.CoolingDashCard })) },
    { id: "status", order: 150, load: () => import("@kit/components/dash/StatusCard").then((m) => ({ default: m.StatusCard })) },
  ],
  quickAdd: [{
    kind: "touch", name: "Temas", key: "T", dest: "Kişinin zaman çizelgesi", icon: BOARD_ICON.comment, tone: "info", group: "Kişiler ve iletişim", order: 30,
    form: { noun: "Temas", dest: "Kişinin zaman çizelgesine eklenir", icon: BOARD_ICON.comment, base: "/touches", editId: (p) => p.edit, page: () => PATHS.timeline },
    load: () => import("@kit/forms/ContactForms").then((m) => ({ default: m.TouchForm })),
  }],
});
