import { z } from "zod";
import { docKit } from "@fullfollow/core";
import { POST_PLATFORMS } from "../service/constants";
import { postCreate, postUpdate } from "../service/schemas";

const { crud, defineDocs, flag, positiveInt, saveResult } = docKit;

/** API documentation of the posts routes (`GET /api/docs`); the request shapes are the module's own Zod schemas */
export const docs = defineDocs({
  ...crud("/api/posts", {
    noun: "post",
    filters: {
      platform: z.enum(POST_PLATFORMS).optional(),
      refresh_due: flag("Posts whose refresh reminder has come"),
      idea_id: positiveInt.optional(),
    },
    create: postCreate,
    update: postUpdate,
    list: { description: "`q` searches title, url, body and notes." },
  }),
  "POST /api/posts/:id/refresh": { summary: "Mark a post refreshed", description: "The refresh date becomes today.", response: saveResult },
});
