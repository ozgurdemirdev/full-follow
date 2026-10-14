import type { Ctx } from "@fullfollow/core";
import { draftsService } from "./drafts";

const cache = new WeakMap<Ctx, { drafts: ReturnType<typeof draftsService> }>();

/** The drafts module's services, built once per context (the context lives as long as its app; the WeakMap holds nothing beyond it) */
export function draftsServices(ctx: Ctx) {
  let s = cache.get(ctx);
  if (!s) cache.set(ctx, (s = { drafts: draftsService(ctx) }));
  return s;
}
