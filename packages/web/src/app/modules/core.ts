// What the kit itself puts on screen, in the same shape as a module's manifest: the dashboard and comments pages, the comments card and form.
// (Settings is the host of its own categories, see pages/Settings.tsx.) Always on: it is never hidden or removed.
import { useThreads } from "../../api/keys";
import { BOARD_ICON } from "../../components/boardIcons";
import { PATHS } from "../routes";
import { defineWebModule } from "./define";

const COMMENTS = "/yorumlar";

export const core = defineWebModule({
  key: "core",
  label: "Çekirdek",
  routes: [
    { page: "today", path: PATHS.today, load: () => import("../../pages/Today") },
    { page: "comments", path: COMMENTS, params: "/:id?", load: () => import("../../pages/Comments") },
    { page: "settings", path: PATHS.settings, params: "/:kategori?", load: () => import("../../pages/Settings") },
  ],
  nav: [
    { group: "Network", order: 10, label: "Dashboard", icon: "grid", path: PATHS.today },
    { group: "Network", order: 70, label: "Yorumlar", icon: "comment", path: COMMENTS, useBadge: () => useThreads().rows.length },
  ],
  dashboard: [
    { id: "comments", column: 2, order: 140, load: () => import("../../components/dash/CommentsCard").then((m) => ({ default: m.CommentsCard })) },
  ],
  quickAdd: [
    {
      kind: "comment", name: "Yorum", key: "R", dest: "Kaydın yorumları", icon: BOARD_ICON.comment, tone: "comment", group: "Kişiler ve iletişim", order: 50,
      form: { noun: "Yorum", dest: "Yorumlar’a eklenir", icon: BOARD_ICON.comment, base: "/comments", page: (id) => (id ? `${COMMENTS}/${id}` : PATHS.today) },
      load: () => import("../../forms/CommentForm").then((m) => ({ default: m.CommentForm })),
    },
  ],
  links: { comment: (id) => `${COMMENTS}/${id}` },
});
