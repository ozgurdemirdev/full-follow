import type { Ctx, PostsApi } from "@fullfollow/core";
import { postsService } from "./service/posts";

/** The posts module's implementation of its contract (`PostsApi` in core's contracts) */
// post rows come from a text column (the schema stays free of module enums); the contract narrows the platform
export const postsApi = (ctx: Ctx): PostsApi => postsService(ctx) as PostsApi;
