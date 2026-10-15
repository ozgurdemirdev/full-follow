// The reports module's web part (the manifest): the report and the weekly review pages (still loaded from the kit) and the review card.
import { defineWebModule } from "@kit/app/modules/define";
import { PATHS } from "@kit/app/routes";

export default defineWebModule({
  key: "reports",
  label: "Raporlar",
  routes: [
    { page: "report", path: PATHS.report, load: () => import("@kit/pages/Report") },
    { page: "review", path: PATHS.review, load: () => import("@kit/pages/Review") },
  ],
  nav: [
    { group: "Satış ve projeler", order: 50, label: "Rapor", icon: "chart", path: PATHS.report },
    { group: "Satış ve projeler", order: 60, label: "Haftalık inceleme", icon: "review", path: PATHS.review },
  ],
  dashboard: [
    { id: "review", order: 10, show: (t) => !!t.review?.ready, load: () => import("@kit/components/dash/ExtraCards").then((m) => ({ default: m.ReviewCard })) },
  ],
});
