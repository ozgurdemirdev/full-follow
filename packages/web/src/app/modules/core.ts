// What the kit itself puts on screen, in the same shape as a module's manifest: the dashboard and comments pages, the comments card and form.
// (Settings is the host of its own categories, see pages/Settings.tsx.) Always on: it is never hidden or removed.
import { useThreads } from "../../api/keys";
import { BOARD_ICON } from "../../components/boardIcons";
import { m as kit } from "../../messages";
import { shell } from "../../messages.shell";
import { PATHS } from "../routes";
import { defineWebModule } from "./define";

const COMMENTS = "/yorumlar";
const m = shell.core;

export const core = defineWebModule({
  key: "core",
  label: m.label,
  routes: [
    { page: "today", path: PATHS.today, load: () => import("../../pages/Today") },
    { page: "comments", path: COMMENTS, params: "/:id?", load: () => import("../../pages/Comments") },
    { page: "settings", path: PATHS.settings, params: "/:kategori?", load: () => import("../../pages/Settings") },
  ],
  nav: [
    { group: kit.navGroups.network, order: 10, label: m.dashboard, icon: "grid", path: PATHS.today },
    { group: kit.navGroups.network, order: 70, label: kit.nouns.comments, icon: "comment", path: COMMENTS, useBadge: () => useThreads().total },
  ],
  dashboard: [
    { id: "comments", column: 2, order: 140, load: () => import("../../components/dash/CommentsCard").then((m) => ({ default: m.CommentsCard })) },
  ],
  quickAdd: [
    {
      kind: "comment", name: kit.nouns.comment, key: "R", dest: m.commentsDest, icon: BOARD_ICON.comment, tone: "comment", group: kit.quickGroups.people, order: 50,
      form: { noun: kit.nouns.comment, dest: m.commentAdded, icon: BOARD_ICON.comment, base: "/comments", page: (id) => (id ? `${COMMENTS}/${id}` : PATHS.today) },
      load: () => import("../../forms/CommentForm").then((m) => ({ default: m.CommentForm })),
    },
  ],
  links: { comment: (id) => `${COMMENTS}/${id}` },
});
