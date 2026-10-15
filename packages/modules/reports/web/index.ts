// The reports module's web part: the manifest the shell builds the report and review routes, nav items, the review card and the money settings from.
import { defineWebModule } from "@kit/app/modules/define";
import { m } from "./messages";
import { REPORT_PATH, REVIEW_PATH } from "./paths";
import { floorRows, paymentTemplateRows } from "./settings";
import { m as kit } from "@kit/messages";

export default defineWebModule({
  key: "reports",
  label: m.label,
  routes: [
    { page: "report", path: REPORT_PATH, load: () => import("./pages/Report") },
    { page: "review", path: REVIEW_PATH, load: () => import("./pages/Review") },
  ],
  nav: [
    { group: kit.navGroups.salesProjects, order: 50, label: m.nav.report, icon: "chart", path: REPORT_PATH },
    { group: kit.navGroups.salesProjects, order: 60, label: m.nav.review, icon: "review", path: REVIEW_PATH },
  ],
  dashboard: [
    { id: "review", order: 10, show: (t) => !!t.review?.ready, load: () => import("./cards/ReviewCard").then((mod) => ({ default: mod.ReviewCard })) },
  ],
  settings: [
    { id: "floor", category: "isletme", order: 10, rows: floorRows },
    { id: "payment-template", category: "isletme", order: 40, rows: paymentTemplateRows },
  ],
  invalidates: {
    people: ["/report", "/review"],
    sources: ["/report"],
    opportunities: ["/report"],
    payments: ["/report"],
    settings: ["/report", "/review"],
    companies: ["/review"],
    touches: ["/review"],
  },
});
