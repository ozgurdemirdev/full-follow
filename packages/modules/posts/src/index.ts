import { defineModule, row, type RecordTrashed } from "@fullfollow/core";
import { postsApi } from "./api";
import { entities } from "./entities";
import { mcp } from "./mcp";
import { POST_PLATFORMS } from "./service/constants";

/**
 * Posts: forum topics and social posts, their refresh reminders and the people, opportunities and money each one brought.
 * Its table (posts) stays in core's schema; removing this package leaves the rows in place.
 */
export default defineModule({
  key: "posts",
  label: "Paylaşımlar",
  smoke: ["/api/posts"],
  uses: ["ideas", "network"],
  api: postsApi,
  entities,
  hooks: {
    // the link from a post to an idea that goes to the trash is emptied (the post stays; restoring ties it back)
    "record.trashed": (_ctx, { type, id, bin }: RecordTrashed) => {
      if (type === "idea") bin.unlink("posts", "idea_id", id);
    },
  },
  contribute: {
    trashTypes: [{ type: "post", label: "paylaşım" }],
    commentTargets: {
      post: { table: "posts", label: (ctx, id) => row(ctx, "SELECT title FROM posts WHERE id = ?", id)?.title ?? `#${id}` },
    },
    chatCards: {
      post: (ctx, id) => {
        const r = ctx.mod("posts")!.get(id);
        if (!r) throw new Error("post not found");
        return { title: r.title, platform: r.platform };
      },
    },
    // posts whose refresh day has come, on the Today view
    today: (ctx, { limit }) => ({ posts_due: ctx.mod("posts")!.list({ limit, filter: { refresh_due: true } }) }),
    // `get(idea, id, with: ["posts"])`
    relations: {
      posts: { on: ["idea"], load: (ctx, by, limit) => ctx.mod("posts")!.list({ filter: by, limit }).rows.slice(0, limit) },
    },
    meta: { post_platforms: POST_PLATFORMS },
  },
  mcp,
});
