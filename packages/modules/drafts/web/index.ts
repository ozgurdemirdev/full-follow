// The drafts module's web part: the manifest the shell builds its route, nav item, dashboard cards, form, settings rows and links from.
import { K } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Today } from "@kit/api/types";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { DraftsWaiting } from "./DraftsWaiting";
import { m } from "./messages";
import { DRAFTS_PATH } from "./paths";
import { draftClaudeRows, followupRows, quotaRows } from "./settings";

export default defineWebModule({
  key: "drafts",
  label: m.label,
  routes: [{ page: "drafts", path: DRAFTS_PATH, params: "/:id?", load: () => import("./pages/Drafts") }],
  nav: [{
    group: m.shared.network, order: 60, label: m.label, icon: "pen", path: DRAFTS_PATH,
    useBadge: () => useQuery<Today>(K.today).data?.drafts?.total,
  }],
  dashboard: [
    { id: "drafts", column: 0, order: 30, show: (t) => !!t.drafts, load: () => import("./cards/DraftsCard").then((mod) => ({ default: mod.DraftsCard })) },
    { id: "followups-due", order: 50, show: (t) => !!t.followups?.total, load: () => import("./cards/FollowupsDueCard").then((mod) => ({ default: mod.FollowupsDueCard })) },
    {
      id: "quota", order: 90, show: (t) => !!t.quota && (t.quota.channels.length > 0 || t.quota.email_warmup.active),
      load: () => import("./cards/QuotaCard").then((mod) => ({ default: mod.QuotaCard })),
    },
  ],
  settings: [
    { id: "followup-days", category: "takip", order: 20, rows: followupRows },
    { id: "quota", category: "takip", order: 40, rows: quotaRows },
    { id: "claude-drafts", category: "claude", order: 20, rows: draftClaudeRows },
  ],
  quickAdd: [{
    kind: "draft", name: m.noun, key: "Y", dest: m.dest, icon: BOARD_ICON.pen, tone: "claude", group: m.shared.contactAndComms, order: 40,
    form: { noun: m.noun, dest: m.addedTo, icon: BOARD_ICON.pen, base: "/drafts", page: byRecord("draft") },
    load: () => import("./forms/DraftForm").then((mod) => ({ default: mod.DraftForm })),
  }],
  links: { draft: (id) => `${DRAFTS_PATH}/${id}` },
  slots: { "person.overlay.deals": { order: 10, Component: DraftsWaiting }, "company.overlay.work.after": DraftsWaiting },
  invalidates: {
    companies: ["/drafts"],
    drafts: ["/drafts", "/settings", "/today", "/timeline", "/touches", "/opportunities", "/people", "/companies", "/network", "/templates", "/followups", "/trash"],
    touches: ["/followups"],
    settings: ["/followups"],
    followups: ["/followups", "/drafts", "/today", "/people", "/companies"],
  },
});
