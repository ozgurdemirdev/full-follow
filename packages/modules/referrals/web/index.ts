// The referrals module's web part: the manifest the shell builds its route and nav item from.
import { defineWebModule } from "@kit/app/modules/define";
import { m as kit } from "@kit/messages";
import { REFERRALS_PATH } from "./paths";

export default defineWebModule({
  key: "referrals",
  label: kit.nouns.referrals,
  routes: [{ page: "referrals", path: REFERRALS_PATH, load: () => import("./pages/Referrals") }],
  nav: [{ group: kit.navGroups.network, order: 50, label: kit.nouns.referrals, icon: "link", path: REFERRALS_PATH }],
});
