// The drafts module's web part (the manifest); pages, cards and forms are still loaded from the kit.
import { K } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Today } from "@kit/api/types";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { PATHS } from "@kit/app/routes";
import { BOARD_ICON } from "@kit/components/boardIcons";

export default defineWebModule({
  key: "drafts",
  label: "Taslaklar",
  routes: [{ page: "drafts", path: PATHS.drafts, params: "/:id?", load: () => import("@kit/pages/Drafts") }],
  nav: [{
    group: "Network", order: 60, label: "Taslaklar", icon: "pen", path: PATHS.drafts,
    useBadge: () => useQuery<Today>(K.today).data?.drafts?.total,
  }],
  dashboard: [
    { id: "drafts", column: 0, order: 30, show: (t) => !!t.drafts, load: () => import("./cards").then((m) => ({ default: m.DraftsDashCard })) },
    { id: "followups-due", order: 50, show: (t) => !!t.followups?.total, load: () => import("./cards").then((m) => ({ default: m.FollowupsDueDashCard })) },
    {
      id: "quota", order: 90, show: (t) => !!t.quota && (t.quota.channels.length > 0 || t.quota.email_warmup.active),
      load: () => import("./cards").then((m) => ({ default: m.QuotaDashCard })),
    },
  ],
  quickAdd: [{
    kind: "draft", name: "Taslak", key: "Y", dest: "Onay için Taslaklar", icon: BOARD_ICON.pen, tone: "claude", group: "Kişiler ve iletişim", order: 40,
    form: { noun: "Taslak", dest: "Taslaklar’a onay için düşer", icon: BOARD_ICON.pen, base: "/drafts", page: byRecord("draft") },
    load: () => import("@kit/forms/MarketingForms").then((m) => ({ default: m.DraftForm })),
  }],
  links: { draft: (id) => `${PATHS.drafts}/${id}` },
});
