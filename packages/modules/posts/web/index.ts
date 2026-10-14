// The posts module's web part (the manifest); pages, cards and forms are still loaded from the kit.
import { K } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Today } from "@kit/api/types";
import { defineWebModule } from "@kit/app/modules/define";
import { byRecord } from "@kit/app/modules/links";
import { PATHS } from "@kit/app/routes";
import { BOARD_ICON } from "@kit/components/boardIcons";

export default defineWebModule({
  key: "posts",
  label: "Paylaşımlar",
  routes: [{ page: "posts", path: PATHS.posts, params: "/:id?", load: () => import("@kit/pages/Posts") }],
  nav: [{
    group: "Pazarlama", order: 10, label: "Paylaşımlar", icon: "megaphone", path: PATHS.posts,
    useBadge: () => useQuery<Today>(K.today).data?.posts_due?.total,
  }],
  dashboard: [
    { id: "posts-due", order: 130, show: (t) => !!t.posts_due?.total, load: () => import("./cards").then((m) => ({ default: m.PostsDueDashCard })) },
  ],
  quickAdd: [{
    kind: "post", name: "Paylaşım", key: "L", dest: "Paylaşımlar", icon: BOARD_ICON.megaphone, tone: "comment", group: "Pazarlama", order: 10,
    form: { noun: "Paylaşım", dest: "Paylaşımlar’a eklenir", icon: BOARD_ICON.megaphone, base: "/posts", editId: (p) => p.post_id, page: byRecord("post") },
    load: () => import("@kit/forms/MarketingForms").then((m) => ({ default: m.PostForm })),
  }],
  links: { post: (id) => `${PATHS.posts}/${id}` },
});
