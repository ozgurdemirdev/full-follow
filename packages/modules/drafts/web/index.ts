// The drafts module's web part: the manifest the shell builds its route, nav item, dashboard cards, form, settings rows and links from.
import { K } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Today } from "@kit/api/types";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { DRAFTS_PATH } from "./paths";
import { draftClaudeRows, followupRows, quotaRows } from "./settings";

export default defineWebModule({
  key: "drafts",
  label: "Taslaklar",
  routes: [{ page: "drafts", path: DRAFTS_PATH, params: "/:id?", load: () => import("./pages/Drafts") }],
  nav: [{
    group: "Network", order: 60, label: "Taslaklar", icon: "pen", path: DRAFTS_PATH,
    useBadge: () => useQuery<Today>(K.today).data?.drafts?.total,
  }],
  dashboard: [
    { id: "drafts", column: 0, order: 30, show: (t) => !!t.drafts, load: () => import("./cards/DraftsCard").then((m) => ({ default: m.DraftsCard })) },
    { id: "followups-due", order: 50, show: (t) => !!t.followups?.total, load: () => import("./cards/FollowupsDueCard").then((m) => ({ default: m.FollowupsDueCard })) },
    {
      id: "quota", order: 90, show: (t) => !!t.quota && (t.quota.channels.length > 0 || t.quota.email_warmup.active),
      load: () => import("./cards/QuotaCard").then((m) => ({ default: m.QuotaCard })),
    },
  ],
  settings: [
    { id: "followup-days", category: "takip", order: 20, rows: followupRows },
    { id: "quota", category: "takip", order: 40, rows: quotaRows },
    { id: "claude-drafts", category: "claude", order: 20, rows: draftClaudeRows },
  ],
  quickAdd: [{
    kind: "draft", name: "Taslak", key: "Y", dest: "Onay için Taslaklar", icon: BOARD_ICON.pen, tone: "claude", group: "Kişiler ve iletişim", order: 40,
    form: { noun: "Taslak", dest: "Taslaklar’a onay için düşer", icon: BOARD_ICON.pen, base: "/drafts", page: byRecord("draft") },
    load: () => import("./forms/DraftForm").then((m) => ({ default: m.DraftForm })),
  }],
  links: { draft: (id) => `${DRAFTS_PATH}/${id}` },
  invalidates: {
    companies: ["/drafts"],
    drafts: ["/drafts", "/settings", "/today", "/timeline", "/touches", "/opportunities", "/people", "/companies", "/network", "/templates", "/followups", "/trash"],
    touches: ["/followups"],
    settings: ["/followups"],
    followups: ["/followups", "/drafts", "/today", "/people", "/companies"],
  },
});
