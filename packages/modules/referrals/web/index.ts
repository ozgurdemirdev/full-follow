// The referrals module's web part (the manifest); its page is still loaded from the kit.
import { defineWebModule } from "@kit/app/modules/define";
import { PATHS } from "@kit/app/routes";

export default defineWebModule({
  key: "referrals",
  label: "Referanslar",
  routes: [{ page: "referrals", path: PATHS.referrals, load: () => import("@kit/pages/Referrals") }],
  nav: [{ group: "Network", order: 50, label: "Referanslar", icon: "link", path: PATHS.referrals }],
});
