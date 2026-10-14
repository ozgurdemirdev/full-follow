import type { Ctx } from "@fullfollow/core";
import { ideasService } from "./ideas";

const cache = new WeakMap<Ctx, { ideas: ReturnType<typeof ideasService> }>();

/** The ideas module's services, built once per context (the context lives as long as its app; the WeakMap holds nothing beyond it) */
export function ideasServices(ctx: Ctx) {
  let s = cache.get(ctx);
  if (!s) cache.set(ctx, (s = { ideas: ideasService(ctx) }));
  return s;
}
