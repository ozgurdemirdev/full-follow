// The referrals module's web part: the manifest the shell builds its route and nav item from.
import { defineWebModule } from "@kit/app/modules/define";
import { REFERRALS_PATH } from "./paths";

export default defineWebModule({
  key: "referrals",
  label: "Referanslar",
  routes: [{ page: "referrals", path: REFERRALS_PATH, load: () => import("./pages/Referrals") }],
  nav: [{ group: "Network", order: 50, label: "Referanslar", icon: "link", path: REFERRALS_PATH }],
});
