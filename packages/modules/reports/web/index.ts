// The reports module's web part: the manifest the shell builds the report and review routes, nav items, the review card and the money settings from.
import { defineWebModule } from "@kit/app/modules/define";
import { REPORT_PATH, REVIEW_PATH } from "./paths";
import { floorRows, paymentTemplateRows } from "./settings";

export default defineWebModule({
  key: "reports",
  label: "Raporlar",
  routes: [
    { page: "report", path: REPORT_PATH, load: () => import("./pages/Report") },
    { page: "review", path: REVIEW_PATH, load: () => import("./pages/Review") },
  ],
  nav: [
    { group: "Satış ve projeler", order: 50, label: "Rapor", icon: "chart", path: REPORT_PATH },
    { group: "Satış ve projeler", order: 60, label: "Haftalık inceleme", icon: "review", path: REVIEW_PATH },
  ],
  dashboard: [
    { id: "review", order: 10, show: (t) => !!t.review?.ready, load: () => import("./cards/ReviewCard").then((m) => ({ default: m.ReviewCard })) },
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
