// The posts module's web part: the manifest the shell builds its route, nav item, dashboard card, form, settings row and links from.
import { K } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Today } from "@kit/api/types";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { PersonPost } from "./PersonPost";
import { POSTS_PATH } from "./paths";
import { postRefreshRows } from "./settings";

export default defineWebModule({
  key: "posts",
  label: "Paylaşımlar",
  routes: [{ page: "posts", path: POSTS_PATH, params: "/:id?", load: () => import("./pages/Posts") }],
  nav: [{
    group: "Pazarlama", order: 10, label: "Paylaşımlar", icon: "megaphone", path: POSTS_PATH,
    useBadge: () => useQuery<Today>(K.today).data?.posts_due?.total,
  }],
  dashboard: [
    { id: "posts-due", order: 130, show: (t) => !!t.posts_due?.total, load: () => import("./cards/PostsDueCard").then((m) => ({ default: m.PostsDueCard })) },
  ],
  settings: [{ id: "post-refresh", category: "takip", order: 30, rows: postRefreshRows }],
  quickAdd: [{
    kind: "post", name: "Paylaşım", key: "L", dest: "Paylaşımlar", icon: BOARD_ICON.megaphone, tone: "comment", group: "Pazarlama", order: 10,
    form: { noun: "Paylaşım", dest: "Paylaşımlar’a eklenir", icon: BOARD_ICON.megaphone, base: "/posts", editId: (p) => p.post_id, page: byRecord("post") },
    load: () => import("./forms/PostForm").then((m) => ({ default: m.PostForm })),
  }],
  links: { post: (id) => `${POSTS_PATH}/${id}` },
  slots: { "person.overlay.marketing": { order: 10, Component: PersonPost } },
  invalidates: {
    people: ["/posts"],
    posts: ["/posts", "/today", "/people", "/ideas", "/report", "/trash"],
  },
});
